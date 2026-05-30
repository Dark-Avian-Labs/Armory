import { Router } from 'express';

import { buildsRouter } from './buildsRouter.js';
import { catalogRouter } from './catalogRouter.js';
import { loadoutsRouter } from './loadoutsRouter.js';

export const apiRouter = Router();

apiRouter.use(catalogRouter);
apiRouter.use(buildsRouter);
apiRouter.use(loadoutsRouter);
