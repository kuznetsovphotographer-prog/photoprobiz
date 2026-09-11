import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const directoryRoutes = ['/thankyou', '/cookie', '/privacy', '/consent', '/biznes-portret', '/korporativnaya-fotosessiya', '/fotosessiya-sotrudnikov-v-ofise', '/delovaya-fotosessiya-dlya-vrachey'];

export default defineConfig({
  base: './',
  plugins: [{
    name: 'static-page-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname && directoryRoutes.includes(pathname)) {
          res.writeHead(302, { Location: pathname + '/' + (req.url?.slice(pathname.length) ?? '') }); res.end(); return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname && directoryRoutes.includes(pathname)) {
          res.writeHead(302, { Location: pathname + '/' + (req.url?.slice(pathname.length) ?? '') }); res.end(); return;
        }
        next();
      });
    },
  }],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rolldownOptions: { input: {
      main: resolve('index.html'),
      thankyou: resolve('thankyou/index.html'),
      cookie: resolve('cookie/index.html'),
      privacy: resolve('privacy/index.html'),
      consent: resolve('consent/index.html'),
      thankyouAlias: resolve('page132097826.html'),
      cookieAlias: resolve('page135439646.html'),
      notFound: resolve('404.html'),
      businessPortrait: resolve('biznes-portret/index.html'),
      corporateSession: resolve('korporativnaya-fotosessiya/index.html'),
      officeEmployees: resolve('fotosessiya-sotrudnikov-v-ofise/index.html'),
      doctors: resolve('delovaya-fotosessiya-dlya-vrachey/index.html'),
    } },
  },
});
