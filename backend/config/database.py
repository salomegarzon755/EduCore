import psycopg2
from psycopg2 import pool

class DatabaseConnection:
    _connection_pool = None

    @classmethod
    def initialize(cls, dbname="educore_db", user="postgres", password="1234", host="localhost", port="5432"):
        if cls._connection_pool is None:
            try:
                cls._connection_pool = pool.SimpleConnectionPool(
                    1, 10,
                    dbname=dbname,
                    user=user,
                    password=password,
                    host=host,
                    port=port
                )
                print("Conexión exitosa a PostgreSQL (educore_db)")
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
    def release_connection(cls, connection):
        cls.return_connection(connection)

    @classmethod
    def close_all(cls):
        if cls._connection_pool:
            cls._connection_pool.closeall()