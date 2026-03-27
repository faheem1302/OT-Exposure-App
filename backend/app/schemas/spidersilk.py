"""
app/schemas/spidersilk.py
Pydantic v2 models for the SpiderSilk assets API.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _parse_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


class SpiderSilkAsset(BaseModel):
    """Single SpiderSilk asset record returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ip: Optional[str] = None
    port: Optional[int] = None
    service: Optional[str] = None
    scan_region: Optional[str] = None
    tag: Optional[str] = None
    response_code: Optional[int] = None
    title: Optional[str] = None
    asn_number: Optional[int] = None
    asn_organization: Optional[str] = None
    isp_name: Optional[str] = None
    isp_organization: Optional[str] = None
    location_continent: Optional[str] = None
    location_country_iso: Optional[str] = None
    location_country_name: Optional[str] = None
    location_city: Optional[str] = None
    location_lat: Optional[float] = None
    location_long: Optional[float] = None
    headers_json: Optional[Dict[str, Any]] = None
    ip_profile: Optional[List[Any]] = None
    rdns_profile: Optional[List[Any]] = None
    tech_stack_json: Optional[List[Any]] = None
    vulnerabilities_json: Optional[List[Any]] = None
    certificate_json: Optional[Dict[str, Any]] = None
    ingested_at: Optional[datetime] = None

    @field_validator(
        "headers_json", "certificate_json", "ip_profile",
        "rdns_profile", "tech_stack_json", "vulnerabilities_json",
        mode="before",
    )
    @classmethod
    def _parse(cls, v: Any) -> Any:
        return _parse_json(v)


class SpiderSilkSummary(BaseModel):
    """High-level KPIs for the SpiderSilk assets dataset."""

    total_assets: int
    unique_ips: int
    unique_services: int
    top_country: Optional[str] = None
    top_service: Optional[str] = None


class SpiderSilkCountryStat(BaseModel):
    """Asset count per country."""

    model_config = ConfigDict(from_attributes=True)

    location_country_iso: Optional[str] = None
    location_country_name: Optional[str] = None
    count: int


class SpiderSilkServiceStat(BaseModel):
    """Asset count per service."""

    model_config = ConfigDict(from_attributes=True)

    service: Optional[str] = None
    count: int


class SpiderSilkPortStat(BaseModel):
    """Asset count per port."""

    model_config = ConfigDict(from_attributes=True)

    port: Optional[int] = None
    count: int
