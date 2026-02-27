export type ZipListing = {
  url: string;
  title?: string;
  price?: string;
  source?: string;
  summary?: string;
};

export type ZipListingsResponse = {
  zip: string;
  listings: ZipListing[];
};

