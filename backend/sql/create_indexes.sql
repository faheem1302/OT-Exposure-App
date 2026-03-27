-- OT/ICS Cybersecurity Exposure Dashboard
-- Indexes for shodan_exposures table
-- Optimized for common dashboard query patterns

-- Index on ip_str for IP-based lookups and filtering
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_ip_str
    ON shodan_exposures (ip_str);

-- Index on port for protocol/port-based filtering (critical for OT protocol detection)
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_port
    ON shodan_exposures (port);

-- Index on api (OT/ICS protocol category) for category-based dashboards
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_api
    ON shodan_exposures (api);

-- Index on country_code for geographic filtering
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_country_code
    ON shodan_exposures (country_code);

-- Index on city for city-level geographic filtering
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_city
    ON shodan_exposures (city);

-- Index on timestamp for time-series queries and timeline dashboard
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_timestamp
    ON shodan_exposures (timestamp DESC);

-- Index on org for organization-based risk analysis
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_org
    ON shodan_exposures (org);

-- Composite index for common combined filter: category + city
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_api_city
    ON shodan_exposures (api, city);

-- Composite index for geographic clustering queries
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_lat_lon
    ON shodan_exposures (latitude, longitude);

-- Partial index for critical exposures (records with known vulnerabilities)
-- Used by risk dashboard queries
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_vulns_not_null
    ON shodan_exposures (id)
    WHERE vulns IS NOT NULL AND vulns != '{}';

-- Partial index for OT critical ports (Modbus:502, S7:102, EtherNet/IP:44818, DNP3:20000)
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_ot_critical_ports
    ON shodan_exposures (port, org)
    WHERE port IN (102, 502, 44818, 20000);

-- GIN index on hostnames array for array containment queries
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_hostnames_gin
    ON shodan_exposures USING GIN (hostnames);

-- GIN index on domains array for array containment queries
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_domains_gin
    ON shodan_exposures USING GIN (domains);

-- GIN index on tags array for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_tags_gin
    ON shodan_exposures USING GIN (tags);

-- GIN index on cpe23 for CPE-based vulnerability lookups
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_cpe23_gin
    ON shodan_exposures USING GIN (cpe23);

-- Full-text search index on data (banner) and org for search endpoint
CREATE INDEX IF NOT EXISTS idx_shodan_exposures_data_fts
    ON shodan_exposures USING GIN (to_tsvector('english', COALESCE(data, '') || ' ' || COALESCE(org, '') || ' ' || COALESCE(ip_str, '')));
