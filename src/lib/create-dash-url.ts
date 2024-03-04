/**
 * Creates a URL for a TagoIO dashboard with the given ID and query parameters.
 * @param dashID - The ID of the dashboard to create the URL for.
 * @param params - An object containing key-value pairs to be used as query parameters in the URL.
 * @returns The URL for the dashboard with the given ID and query parameters.
 */
function createDashURL(dashID: string, params: { [key: string]: string }) {
  const url = `https://admin.tago.io/dashboards/info/${dashID}`;
  const paramsURL = new URLSearchParams(params).toString();
  if (paramsURL.length === 0) {
    return `${url}`;
  }
  return `${url}?${paramsURL}`;
}

export { createDashURL };
