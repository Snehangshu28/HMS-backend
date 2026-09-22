import { Router } from 'express';
import {
  addInventoryItem,
  getInventoryItems,
  updateInventoryItem,
  adjustInventoryStock,
  addVendor,
  getVendors,
  updateVendor,
} from './inventory.controller';
import {
  listStores,
  createStore,
  listCategories,
  createCategory,
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogItemByBarcode,
  getStock,
  getItemStock,
  listBatches,
  consumeStock,
  createTransfer,
  listTransfers,
  approveTransfer,
  completeTransfer,
  createPurchaseOrder,
  listPurchaseOrders,
  createGoodsReceipt,
  adjustBatchStock,
  getDashboard,
  getExpiry,
  getLowStock,
  getTransactions,
  getReports,
  receiveByBarcodeHandler,
  inventoryScanHandler,
  inventoryScanSessionHandler,
  inventoryApplyProcedureHandler,
  patientConsumptionHandler,
} from './smart.controller';
import { protect, authorize } from '../../middleware/auth';

const router = Router();

const adminPharm = authorize('Hospital Admin', 'Pharmacist');
const adminPharmNurse = authorize('Hospital Admin', 'Pharmacist', 'Nurse');
const consumeRoles = authorize('Hospital Admin', 'Pharmacist', 'Nurse', 'Doctor', 'Receptionist');
const approveRoles = authorize('Hospital Admin', 'Pharmacist');

router.use(protect);

/* ── Smart inventory APIs (specific paths first) ── */
router.get('/dashboard', adminPharmNurse, getDashboard);
router.get('/reports', adminPharm, getReports);
router.get('/expiry', adminPharmNurse, getExpiry);
router.get('/low-stock', adminPharmNurse, getLowStock);
router.get('/transactions', adminPharm, getTransactions);
router.get('/patient-consumption', consumeRoles, patientConsumptionHandler);
router.get('/patient-consumption/:patientId', consumeRoles, patientConsumptionHandler);

/* Manufacturer barcode receive + nurse scan */
router.post('/receive', adminPharm, receiveByBarcodeHandler);
router.post('/scan', consumeRoles, inventoryScanHandler);
router.post('/scan/session', consumeRoles, inventoryScanSessionHandler);
router.post('/procedures/apply', consumeRoles, inventoryApplyProcedureHandler);

router.route('/stores').get(adminPharmNurse, listStores).post(adminPharm, createStore);

router.route('/categories').get(adminPharmNurse, listCategories).post(adminPharm, createCategory);

router
  .route('/items')
  .get(adminPharmNurse, listCatalogItems)
  .post(adminPharm, createCatalogItem);

router.get('/items/by-barcode/:code', consumeRoles, getCatalogItemByBarcode);
router.put('/items/:id', adminPharm, updateCatalogItem);
router.delete('/items/:id', adminPharm, deleteCatalogItem);

router.get('/stock', adminPharmNurse, getStock);
router.get('/stock/:itemId', adminPharmNurse, getItemStock);
router.get('/batches', adminPharmNurse, listBatches);

router.post('/consume', consumeRoles, consumeStock);

router.route('/transfers').get(adminPharmNurse, listTransfers).post(adminPharmNurse, createTransfer);
router.post('/transfers/:id/approve', approveRoles, approveTransfer);
router.post('/transfers/:id/complete', approveRoles, completeTransfer);

router
  .route('/purchase-orders')
  .get(adminPharm, listPurchaseOrders)
  .post(adminPharm, createPurchaseOrder);

router.post('/goods-receipts', adminPharm, createGoodsReceipt);
router.post('/adjustments', approveRoles, adjustBatchStock);

/* ── Legacy asset inventory + vendors ── */
router
  .route('/vendors')
  .post(authorize('Hospital Admin'), addVendor)
  .get(adminPharm, getVendors);

router.put('/vendors/:id', authorize('Hospital Admin'), updateVendor);

router
  .route('/')
  .post(adminPharm, addInventoryItem)
  .get(adminPharmNurse, getInventoryItems);

router.put('/:id', adminPharm, updateInventoryItem);
router.post('/:id/adjust', adminPharm, adjustInventoryStock);

export default router;
