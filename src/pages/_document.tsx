import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
	return (
		<Html lang="en">
			<Head>
				<meta charSet="utf-8" />
				<meta name="description" content="OpenElara Cloud - Sovereign AI with BYOK (Bring Your Own Keys)" />
				<link rel="icon" type="image/png" href="/icon.png" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				<meta name="theme-color" content="#00d4ff" />

				{/* PWA Manifest */}
				<link rel="manifest" href="/manifest.json" />

				{/* PWA Meta Tags */}
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
				<meta name="apple-mobile-web-app-title" content="OpenElara" />
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
