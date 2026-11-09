-- Property groups: listings that are the same physical property
-- (units that also book together as a combined listing).
-- One row per member listing. Managed from /admin/properties.
-- See lib/property-groups.js for how the dashboard uses it.
CREATE TABLE IF NOT EXISTS `pbm-pl-data-bank.mira_app.app_property_groups` (
  group_id      STRING NOT NULL OPTIONS (description = 'Property id (UUID); shared by all members'),
  property_name STRING NOT NULL OPTIONS (description = 'Name shown on the dashboard'),
  client_name   STRING NOT NULL OPTIONS (description = 'Same client_name as the performance views'),
  listing_id    STRING NOT NULL OPTIONS (description = 'PriceLabs listing id (vw_listing_performance.listing_id)'),
  member_role   STRING NOT NULL OPTIONS (description = 'unit = a physical unit; combined = books several units at once'),
  units_covered INT64           OPTIONS (description = 'combined only: how many units one booking occupies'),
  created_at    TIMESTAMP       OPTIONS (description = 'When the group was saved'),
  created_by    STRING          OPTIONS (description = 'Admin email that saved the group')
)
OPTIONS (description = 'Client dashboard: listings grouped into one property (combined + unit listings)');
