/** Names of the CMS tables for a prefix (config `tablePrefix`) */
export function cmsTables(prefix = 'cms_') {
  return {
    sections: `${prefix}sections`,
    documents: `${prefix}documents`,
    revisions: `${prefix}revisions`,
    seeds: `${prefix}seeds`,
  }
}
