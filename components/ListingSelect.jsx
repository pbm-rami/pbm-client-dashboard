'use client';

/**
 * Listing filter: "All Listings", whole properties (combined units, see
 * lib/property-groups.js) and individual listings.
 */
export default function ListingSelect({ value, onChange, listingNames, properties = [], className }) {
  const listingOptions = listingNames.map(name => (
    <option key={name} value={name}>{name}</option>
  ));

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className}>
      <option value="all">All Listings</option>
      {properties.length > 0 ? (
        <>
          <optgroup label="Whole properties (units combined)">
            {properties.map(p => (
              <option key={p.key} value={p.key}>🏠 {p.property_name}: whole property</option>
            ))}
          </optgroup>
          <optgroup label="Listings">{listingOptions}</optgroup>
        </>
      ) : listingOptions}
    </select>
  );
}
