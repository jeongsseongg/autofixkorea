import {mount as mountShell} from '../features/site-shell/index.js';
import {mount as mountConsultation} from '../features/consultation-form/index.js';
import {createConsultationService} from '../services/consultation/index.js';
import {configuration} from '../config/site.js';
import {mount as mountContactDialog} from '../features/contact-dialog/index.js';

mountShell();
mountConsultation({service:createConsultationService(configuration.consultation)});
mountContactDialog();

const shared = ['consultation-bar'];
const pages = {
  home:['chat-demo','auction-preview','review-slider','blog-feed','service-cards','policies'],
  news:['purchase-process'],
  review:['purchase-reviews'],
  pro:['promotors'],
  car:['auction-link'],
  '19':['board'],
};
for (const feature of [...shared,...(pages[document.body.dataset.page] || [])]) {
  const module = await import(`../features/${feature}/index.js`);
  await module.mount();
}
