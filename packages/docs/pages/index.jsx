import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

const paths = [
  {
    kicker: 'ASSET MANAGER',
    title: 'Keep asset selections with your code',
    body: 'Pin immutable asset versions in Git, load from the cloud, or pull once for local development and offline builds.',
    code: `loa add acme/furniture/chair@2.3.0 --as chair
loa pull
loa resolve --mode local`,
    to: '/asset-manager',
    link: 'Asset manager overview',
  },
  {
    kicker: 'CLI',
    title: 'Script it from your terminal',
    body: 'Upload, download, and manage assets from your shell or CI with the loa command.',
    code: `npm install -g @threeify/cli
loa auth login

loa assets create --file chair.glb \\
  --org my-org --project my-project \\
  --visibility PRIVATE`,
    to: '/cli',
    link: 'CLI reference',
  },
  {
    kicker: 'SDK',
    title: 'Build it into your app',
    body: 'A typed TypeScript client with Zod-validated requests and responses.',
    code: `import {
  createSecretTokenInstance,
  listAssets,
} from '@threeify/sdk';

const client = createSecretTokenInstance({
  secretToken: process.env.LOA_TOKEN,
});
const assets = await listAssets(client, {
  query: {
    orgName: 'my-org',
    projectName: 'my-project',
  },
});`,
    to: '/sdk',
    link: 'SDK reference',
  },
  {
    kicker: 'REST API',
    title: 'Call it from any language',
    body: 'Plain HTTPS and JSON, authenticated with a bearer API token.',
    code: `curl -H "Authorization: Bearer $LOA_TOKEN" \\
  https://api.threeify.com/assets/my-org/my-project`,
    to: '/api',
    link: 'REST API reference',
  },
];

export default function Home() {
  return (
    <Layout
      title="Developer docs"
      description="Automate Threeify with the loa CLI, the TypeScript SDK, or the REST API."
    >
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>THREEIFY DEVELOPER DOCS</p>
          <h1>
            Automate your 3D asset pipeline.
            <br />
            <em>CLI, SDK, or REST API.</em>
          </h1>
          <p className={styles.lead}>
            Keep asset versions with your code, then upload, convert, and deliver models, materials, and environments.
            Create an API token in the <a href="https://threeify.com">Threeify dashboard</a>, pick the tool that fits
            your workflow, and you are a few lines from your first asset.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="https://threeify.com/signup">
              Create Account <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.secondary} to="/asset-manager">
              Explore the asset manager <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.cards} aria-label="Ways to integrate">
          {paths.map((path) => (
            <article key={path.kicker} className={styles.card}>
              <p className={styles.kicker}>{path.kicker}</p>
              <h3>{path.title}</h3>
              <p>{path.body}</p>
              <pre className={styles.example}>
                <code>{path.code}</code>
              </pre>
              <Link to={path.to}>{path.link} →</Link>
            </article>
          ))}
        </section>
      </main>
    </Layout>
  );
}
