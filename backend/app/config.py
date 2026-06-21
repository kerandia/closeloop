from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://closeloop:closeloop@localhost:5432/closeloop"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    # Model for the Closing Kit / visual agent (Code Interpreter). Override with a
    # stronger model when available, e.g. CLOSING_KIT_MODEL=gpt-4.5-preview / gpt-5.
    closing_kit_model: str = "gpt-4o"

    # ElevenLabs
    elevenlabs_api_key: str = ""

    # Twilio (real-time co-pilot channels: SMS via trial number, WhatsApp via sandbox)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""  # e.g. "whatsapp:+14155238886" (sandbox number)
    twilio_sms_from: str = ""  # your Twilio trial/SMS number, e.g. "+15005550006"
    twilio_template_sid: str = ""  # optional Content template SID for outside-24h WhatsApp sends

    # Feature flags
    live_voice: bool = False
    real_send: bool = False
    ghost_radar: bool = False
    closing_kit_enabled: bool = True  # the visual-generator agent (Code Interpreter)

    @property
    def _twilio_auth(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token)

    @property
    def whatsapp_configured(self) -> bool:
        return self._twilio_auth and bool(self.twilio_whatsapp_from)

    @property
    def sms_configured(self) -> bool:
        return self._twilio_auth and bool(self.twilio_sms_from)

    def channel_configured(self, channel: str) -> bool:
        return {"whatsapp": self.whatsapp_configured, "sms": self.sms_configured}.get(
            channel, False
        )

    # App
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
