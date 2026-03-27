"""
app/schemas/exposure.py
Pydantic v2 models for the OT/ICS Cybersecurity Exposure Dashboard.

Models
------
ExposureBase        — shared field definitions
ExposureCreate      — for inserting new records (thin wrapper)
ExposureResponse    — full API response with all fields
MapPoint            — lightweight model for map rendering
ClusterPoint        — lat/lon bucket with count for cluster maps
StatsSummary        — high-level dashboard KPIs
CategoryStat        — count per OT/ICS protocol category
CityStat            — count per city
PortStat            — count per port
TimelineStat        — count per day for timeline chart
TopOrg              — organisation risk summary
CriticalIP          — host with known vulnerabilities
RiskScore           — composite risk score for the whole dataset
PaginatedResponse   — generic paginated wrapper
ExposureFilter      — query-parameter model for list endpoints
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Generic type variable for PaginatedResponse
# ---------------------------------------------------------------------------
T = TypeVar("T")


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _parse_json_field(value: Any) -> Any:
    """
    Accept either a dict/list (already parsed) or a JSON string and return
    a Python object.  Returns None for null-like inputs.
    """
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


# ---------------------------------------------------------------------------
# Base exposure model
# ---------------------------------------------------------------------------

class ExposureBase(BaseModel):
    """Shared field definitions used by Create and Response models."""

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        arbitrary_types_allowed=True,
    )

    hash: Optional[str] = None
    asn: Optional[str] = None
    http: Optional[Dict[str, Any]] = None
    os: Optional[str] = None
    timestamp: Optional[datetime] = None
    isp: Optional[str] = None
    transport: Optional[str] = None
    shodan_meta: Optional[Dict[str, Any]] = Field(None, alias="_shodan")
    hostnames: Optional[List[str]] = None
    location: Optional[Dict[str, Any]] = None
    ip: Optional[int] = None
    domains: Optional[List[str]] = None
    org: Optional[str] = None
    data: Optional[str] = None
    port: Optional[int] = None
    ip_str: Optional[str] = None
    api: Optional[str] = None
    city: Optional[str] = None
    region_code: Optional[str] = None
    area_code: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    cloud: Optional[Dict[str, Any]] = None
    product: Optional[str] = None
    tags: Optional[List[str]] = None
    cpe23: Optional[List[str]] = None
    cpe: Optional[List[str]] = None
    version: Optional[str] = None
    vulns: Optional[Dict[str, Any]] = None
    ssl: Optional[Dict[str, Any]] = None

    # ------------------------------------------------------------------
    # Validators: coerce JSON strings → dicts for JSONB columns
    # ------------------------------------------------------------------

    @field_validator("http", "ssl", "vulns", "location", "cloud", "shodan_meta", mode="before")
    @classmethod
    def _parse_json(cls, v: Any) -> Any:
        return _parse_json_field(v)


# ---------------------------------------------------------------------------
# Create model
# ---------------------------------------------------------------------------

class ExposureCreate(ExposureBase):
    """Model used when inserting a new exposure record (no id / timestamps)."""
    pass


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class ExposureResponse(ExposureBase):
    """Full API response model including database-generated fields."""

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Expose _shodan field under its original key in JSON output
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        arbitrary_types_allowed=True,
    )


# ---------------------------------------------------------------------------
# Map models
# ---------------------------------------------------------------------------

class MapPoint(BaseModel):
    """Lightweight model for rendering a single point on the exposure map."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_str: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    org: Optional[str] = None
    api: Optional[str] = None
    port: Optional[int] = None
    vulns: Optional[Dict[str, Any]] = None

    @field_validator("vulns", mode="before")
    @classmethod
    def _parse_vulns(cls, v: Any) -> Any:
        return _parse_json_field(v)


class ClusterPoint(BaseModel):
    """Aggregated geographic cluster for heatmap/cluster-map rendering."""

    model_config = ConfigDict(from_attributes=True)

    latitude: float
    longitude: float
    count: int


# ---------------------------------------------------------------------------
# Stats models
# ---------------------------------------------------------------------------

class StatsSummary(BaseModel):
    """High-level KPIs shown at the top of the dashboard."""

    total_exposures: int = Field(..., description="Total number of exposure records")
    unique_ips: int = Field(..., description="Number of distinct IP addresses")
    unique_orgs: int = Field(..., description="Number of distinct organisations")
    top_city: Optional[str] = Field(None, description="City with most exposures")
    top_category: Optional[str] = Field(None, description="OT/ICS protocol with most exposures")


class CategoryStat(BaseModel):
    """Exposure count broken down by OT/ICS protocol / API category."""

    model_config = ConfigDict(from_attributes=True)

    api: Optional[str] = None
    count: int


class CityStat(BaseModel):
    """Exposure count broken down by city."""

    model_config = ConfigDict(from_attributes=True)

    city: Optional[str] = None
    count: int


class PortStat(BaseModel):
    """Exposure count broken down by port number."""

    model_config = ConfigDict(from_attributes=True)

    port: Optional[int] = None
    count: int


class ProductStat(BaseModel):
    """Exposure count broken down by product/vendor name."""

    model_config = ConfigDict(from_attributes=True)

    product: Optional[str] = None
    count: int


class TimelineStat(BaseModel):
    """Daily exposure count for timeline / trend charts."""

    model_config = ConfigDict(from_attributes=True)

    date: Optional[str] = Field(None, description="Date string YYYY-MM-DD")
    count: int


class GCCCountryStat(BaseModel):
    """Exposure count per country."""

    model_config = ConfigDict(from_attributes=True)

    country_code: Optional[str] = None
    country_name: Optional[str] = None
    count: int


# ---------------------------------------------------------------------------
# Risk models
# ---------------------------------------------------------------------------

class TopOrg(BaseModel):
    """Organisation risk summary — used in the risk leaderboard."""

    model_config = ConfigDict(from_attributes=True)

    org: Optional[str] = None
    exposure_count: int = Field(..., description="Total number of exposed hosts")
    vuln_count: int = Field(0, description="Hosts with known CVEs")
    risk_score: float = Field(
        ...,
        description="Composite risk score 0–100 (exposure_count*2 + vuln_count*10, capped at 100)",
    )


class CriticalIP(BaseModel):
    """A host that has at least one known vulnerability."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_str: Optional[str] = None
    org: Optional[str] = None
    city: Optional[str] = None
    country_code: Optional[str] = None
    port: Optional[int] = None
    api: Optional[str] = None
    vulns: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

    @field_validator("vulns", mode="before")
    @classmethod
    def _parse_vulns(cls, v: Any) -> Any:
        return _parse_json_field(v)


class RiskScore(BaseModel):
    """Composite risk score for the entire dataset."""

    total_score: float = Field(
        ...,
        description="Normalised composite risk score 0–100",
    )
    total_exposures: int
    unique_ips: int
    critical_port_exposures: int = Field(
        ...,
        description="Exposures on critical OT ports (102, 502, 44818, 20000)",
    )
    total_vulns: int = Field(
        ...,
        description="Records with at least one known CVE",
    )
    breakdown: Dict[str, float] = Field(
        ...,
        description="Component scores before normalisation",
    )


# ---------------------------------------------------------------------------
# Paginated response wrapper
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated list response."""

    items: List[T]
    total: int = Field(..., description="Total number of matching records")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    pages: int = Field(..., description="Total number of pages")

    @model_validator(mode="after")
    def _compute_pages(self) -> "PaginatedResponse[T]":
        if self.page_size > 0:
            object.__setattr__(
                self,
                "pages",
                max(1, (self.total + self.page_size - 1) // self.page_size),
            )
        return self


# ---------------------------------------------------------------------------
# Filter / query-parameter model
# ---------------------------------------------------------------------------

class ExposureFilter(BaseModel):
    """
    Query parameters accepted by GET /api/exposures.
    Used as a Depends() dependency in the router.
    """

    model_config = ConfigDict(populate_by_name=True)

    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=50, ge=1, le=500, description="Items per page")
    category: Optional[str] = Field(None, description="Filter by OT/ICS protocol (api column)")
    city: Optional[str] = Field(None, description="Filter by city")
    port: Optional[int] = Field(None, description="Filter by port number")
    org: Optional[str] = Field(None, description="Filter by organisation (partial match)")
    search: Optional[str] = Field(
        None,
        description="Full-text search across ip_str, org and data columns",
    )
    sort_by: str = Field(
        default="timestamp",
        description="Column to sort by",
        pattern=r"^(timestamp|ip_str|org|city|port|api|country_code|updated_at|created_at)$",
    )
    sort_order: str = Field(
        default="desc",
        description="Sort direction",
        pattern=r"^(asc|desc)$",
    )
