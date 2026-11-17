from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, model_validator


class Status(BaseModel):
  code: Optional[int] = None
  message: Optional[str] = None
  details: Optional[list[Dict[str, Any]]] = None


class Operation(BaseModel):
  name: str
  metadata: Dict[str, Any] = Field(
      default_factory=dict, description="Includes '@type' and arbitrary fields"
  )
  done: bool

  # Mutually exclusive fields
  error: Optional[Status] = None
  response: Optional[Dict[str, Any]] = Field(
      default=None, description="Includes '@type' and arbitrary fields"
  )

  @model_validator(mode="after")
  def check_mutually_exclusive(self) -> "Operation":
    if self.error is not None and self.response is not None:
      raise ValueError("Fields 'error' and 'response' are mutually exclusive.")
    return self