interface URLParams {
  [key: string]: string;
}

class URLCreator {
  private baseUrl: string;
  private params: URLParams;

  constructor() {
    this.baseUrl = "";
    this.params = {};
  }

  setBase(url: string): URLCreator {
    this.baseUrl = url;
    return this;
  }

  addParam(key: string, value: string): URLCreator {
    this.params[key] = value;
    return this;
  }

  build(): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(this.params)) {
      searchParams.append(key, value);
    }

    const queryString = searchParams.toString();
    return queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
  }
}

export function createURL(): URLCreator {
  return new URLCreator();
}
