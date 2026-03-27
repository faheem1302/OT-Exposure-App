-- OT/ICS Cybersecurity Exposure Dashboard
-- Table: shodan_exposures
-- Stores all Shodan scan results for OT/ICS device exposure tracking

CREATE TABLE IF NOT EXISTS shodan_exposures (
    id              BIGSERIAL PRIMARY KEY,
    hash            TEXT,
    asn             TEXT,
    http            JSONB,
    os              TEXT,
    timestamp       TIMESTAMPTZ,
    isp             TEXT,
    transport       TEXT,
    _shodan         JSONB,
    hostnames       TEXT[],
    location        JSONB,
    ip              BIGINT,
    domains         TEXT[],
    org             TEXT,
    data            TEXT,
    port            INTEGER,
    ip_str          TEXT,
    api             TEXT,
    city            TEXT,
    region_code     TEXT,
    area_code       TEXT,
    longitude       FLOAT,
    latitude        FLOAT,
    country_code    TEXT,
    country_name    TEXT,
    cloud           JSONB,
    product         TEXT,
    tags            TEXT[],
    cpe23           TEXT[],
    cpe             TEXT[],
    version         TEXT,
    vulns           JSONB,
    ssl             JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_ip_port_timestamp UNIQUE (ip_str, port, timestamp)
);

COMMENT ON TABLE shodan_exposures IS 'Stores Shodan scan results for OT/ICS device exposure tracking';
COMMENT ON COLUMN shodan_exposures.hash IS 'Shodan record hash';
COMMENT ON COLUMN shodan_exposures.asn IS 'Autonomous System Number';
COMMENT ON COLUMN shodan_exposures.http IS 'HTTP banner data as JSONB';
COMMENT ON COLUMN shodan_exposures.os IS 'Operating system';
COMMENT ON COLUMN shodan_exposures.timestamp IS 'Timestamp of Shodan scan';
COMMENT ON COLUMN shodan_exposures.isp IS 'Internet Service Provider';
COMMENT ON COLUMN shodan_exposures.transport IS 'Transport protocol (tcp/udp)';
COMMENT ON COLUMN shodan_exposures._shodan IS 'Shodan metadata';
COMMENT ON COLUMN shodan_exposures.hostnames IS 'Array of resolved hostnames';
COMMENT ON COLUMN shodan_exposures.location IS 'Geographic location data as JSONB';
COMMENT ON COLUMN shodan_exposures.ip IS 'IP address as integer';
COMMENT ON COLUMN shodan_exposures.domains IS 'Array of associated domains';
COMMENT ON COLUMN shodan_exposures.org IS 'Organization name';
COMMENT ON COLUMN shodan_exposures.data IS 'Raw banner data';
COMMENT ON COLUMN shodan_exposures.port IS 'Port number';
COMMENT ON COLUMN shodan_exposures.ip_str IS 'IP address as string';
COMMENT ON COLUMN shodan_exposures.api IS 'OT/ICS protocol/API category (e.g. modbus, s7, dnp3)';
COMMENT ON COLUMN shodan_exposures.city IS 'City name';
COMMENT ON COLUMN shodan_exposures.region_code IS 'Region/state code';
COMMENT ON COLUMN shodan_exposures.area_code IS 'Area code';
COMMENT ON COLUMN shodan_exposures.longitude IS 'Geographic longitude';
COMMENT ON COLUMN shodan_exposures.latitude IS 'Geographic latitude';
COMMENT ON COLUMN shodan_exposures.country_code IS 'ISO 2-letter country code';
COMMENT ON COLUMN shodan_exposures.country_name IS 'Full country name';
COMMENT ON COLUMN shodan_exposures.cloud IS 'Cloud provider metadata as JSONB';
COMMENT ON COLUMN shodan_exposures.product IS 'Product/vendor name';
COMMENT ON COLUMN shodan_exposures.tags IS 'Shodan tags array';
COMMENT ON COLUMN shodan_exposures.cpe23 IS 'CPE 2.3 identifiers';
COMMENT ON COLUMN shodan_exposures.cpe IS 'CPE identifiers';
COMMENT ON COLUMN shodan_exposures.version IS 'Software/firmware version';
COMMENT ON COLUMN shodan_exposures.vulns IS 'Known vulnerabilities as JSONB (CVE data)';
COMMENT ON COLUMN shodan_exposures.ssl IS 'SSL/TLS certificate data as JSONB';
COMMENT ON COLUMN shodan_exposures.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN shodan_exposures.updated_at IS 'Record last update timestamp';
