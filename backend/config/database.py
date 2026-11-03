import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

class DatabaseConnection:
    _connection_pool = None

    @classmethod
    def initialize(cls):
        if cls._connection_pool is None:
            try:
                # Lee las variables del archivo .env o del sistema, usando valores por defecto para desarrollo local
                dbname = os.getenv('DB_NAME', 'educore_db')
                user = os.getenv('DB_USER', 'postgres')
                password = os.getenv('DB_PASSWORD', '1234')
                host = os.getenv('DB_HOST', 'localhost')
                port = os.getenv('DB_PORT', '5432')

                cls._connection_pool = pool.SimpleConnectionPool(
                    1, 10,
                    dbname=dbname,
                    user=user,
                    password=password,
                    host=host,
                    port=port
                )
                print(f"Conexión exitosa a PostgreSQL ({dbname} en {host})")
            except Exception as e:
                print(f"Error al conectar con la base de datos: {e}")

    @classmethod
    def get_connection(cls):
        if cls._connection_pool is None:
            cls.initialize()
        return cls._connection_pool.getconn()

    @classmethod
    def return_connection(cls, connection):
        if cls._connection_pool and connection:
            cls._connection_pool.putconn(connection)

    @classmethod
    def close_all(cls):
        if cls._connection_pool:
            cls._connection_pool.closeall()