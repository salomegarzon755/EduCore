import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()


class DatabaseConnection:
    """Pool de conexiones a PostgreSQL.

    - Nube (Neon / Render): define la variable DATABASE_URL (cadena de conexion completa).
    - Local: usa DB_NAME, DB_USER, DB_PASSWORD, DB_HOST y DB_PORT (archivo backend/.env).
    """
    _connection_pool = None

    # Neon suspende el computo tras unos minutos sin uso: el timeout da margen para que
    # despierte y los keepalives detectan conexiones muertas.
    _EXTRA = dict(
        connect_timeout=15,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )

    @classmethod
    def initialize(cls):
        if cls._connection_pool is not None:
            return
        try:
            dsn = os.getenv('DATABASE_URL')
            if dsn:
                cls._connection_pool = pool.ThreadedConnectionPool(1, 5, dsn=dsn, **cls._EXTRA)
                print("Conexion exitosa a PostgreSQL (DATABASE_URL)")
            else:
                dbname = os.getenv('DB_NAME', 'educore_db')
                host = os.getenv('DB_HOST', 'localhost')
                cls._connection_pool = pool.ThreadedConnectionPool(
                    1, 10,
                    dbname=dbname,
                    user=os.getenv('DB_USER', 'postgres'),
                    password=os.getenv('DB_PASSWORD'),
                    host=host,
                    port=os.getenv('DB_PORT', '5432'),
                    **cls._EXTRA
                )
                print(f"Conexion exitosa a PostgreSQL ({dbname} en {host})")
        except Exception as e:
            print(f"Error al conectar con la base de datos: {e}")

    @classmethod
    def get_connection(cls):
        if cls._connection_pool is None:
            cls.initialize()
        # "Ping" previo: si la conexion quedo muerta (p. ej. Neon se suspendio), se descarta
        # y se pide otra, en vez de fallar en la primera consulta.
        for _ in range(2):
            conn = cls._connection_pool.getconn()
            try:
                if conn.closed:
                    raise psycopg2.OperationalError("conexion cerrada")
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                conn.rollback()
                return conn
            except psycopg2.Error:
                cls._connection_pool.putconn(conn, close=True)
        return cls._connection_pool.getconn()

    @classmethod
    def return_connection(cls, connection):
        if cls._connection_pool and connection:
            cls._connection_pool.putconn(connection)

    @classmethod
    def close_all(cls):
        if cls._connection_pool:
            cls._connection_pool.closeall()
