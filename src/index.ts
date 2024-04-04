import {Application} from "./application";
import logger from "./logger";

const application = new Application();

application.start()
  .then(() => {
    logger.info('Application started');
  }).catch((error) => {
    logger.error('Error starting application', error);
    process.exit(1);
  });
