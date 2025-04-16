import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Add Content Security Policy to allow images from various domains */}
          <meta
            httpEquiv="Content-Security-Policy"
            content="default-src 'self'; img-src 'self' data: https://*.alchemy.com https://*.cloudflare-ipfs.com https://*.ipfs.io https://*.seadn.io https://*.goonzworld.com https: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'self' https://*.alchemy.com https://*.g.alchemy.com https://cloudflare-ipfs.com https://ipfs.io https://*.seadn.io https://*.goonzworld.com https: wss:;"
          />
          {/* Add Cross-Origin Resource Policy header */}
          <meta
            httpEquiv="Cross-Origin-Resource-Policy"
            content="cross-origin"
          />
          {/* Add Cross-Origin Embedder Policy header */}
          <meta
            httpEquiv="Cross-Origin-Embedder-Policy"
            content="require-corp"
          />
          {/* Add Referrer Policy */}
          <meta
            name="referrer"
            content="no-referrer"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
