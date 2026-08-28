from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_host: str
    db_port: int = 5432
    db_name: str
    db_user: str
    db_password: str

    app_env: str = "development"

    # Mismo criterio que rrhh-app/backend/app/config.py: en prod (BD en la misma máquina)
    # el round-trip de pool_pre_ping cuesta décimas de ms; en dev (BD del otro lado de la
    # red) cuesta ~200ms por request. Configurable por eso, no por gusto.
    db_pool_pre_ping: bool = True
    db_pool_recycle: int = 1800

    # CORS: "" fail-closed; en prod poner el dominio exacto del frontend.
    cors_origins: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
