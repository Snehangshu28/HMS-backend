import { Router, Request, Response } from 'express';
import { AIService } from '../../services/ai.service';
import { protect, authorize } from '../../middleware/auth';
import { sendResponse, asyncHandler } from '../../common';

const router = Router();

router.use(protect);
router.use(authorize('Doctor'));

router.post('/soap-summary', asyncHandler(async (req: Request, res: Response) => {
  const { transcript } = req.body;
  const soapNotes = await AIService.generateSOAPNotes(transcript);
  return sendResponse(res, 200, 'SOAP notes formatted by AI', soapNotes);
}));

router.post('/suggest-diagnosis', asyncHandler(async (req: Request, res: Response) => {
  const { symptoms } = req.body;
  const suggestions = await AIService.suggestDiagnoses(symptoms || []);
  return sendResponse(res, 200, 'Diagnosis suggested by AI', suggestions);
}));

router.post('/parse-prescription', asyncHandler(async (req: Request, res: Response) => {
  const { note } = req.body;
  const medicines = await AIService.parsePrescriptionNote(note);
  return sendResponse(res, 200, 'Prescription parsed by AI', medicines);
}));

export default router;
