import type { MetadataRoute } from 'next';

/**
 * The simulator is a portfolio demonstration, not a public tax resource. Keeping
 * it out of search results means the people who see it are the people who were
 * given the link, which is the intent.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
