import { config } from '../config';

export class AIService {
  /**
   * Parses clinical voice dictation transcriptions into standard SOAP format
   */
  public static async generateSOAPNotes(transcript: string): Promise<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }> {
    console.log(`[AI Service] Formatting transcript: "${transcript.substring(0, 50)}..."`);
    
    // Simulate LLM parsing latency
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      subjective: `Patient notes: ${transcript}`,
      objective: 'Physical evaluation clear. Vitals verified within normal boundaries.',
      assessment: 'Symptoms indicate a provisional diagnosis of acute upper respiratory tract infection.',
      plan: 'Advise hydration, rest, and symptomatic treatment. Follow up if symptoms worsen.'
    };
  }

  /**
   * Suggests clinical codes (ICD-10 style) matching active symptom lists
   */
  public static async suggestDiagnoses(symptoms: string[]): Promise<{
    code: string;
    description: string;
    confidence: number;
  }[]> {
    console.log(`[AI Service] Matching symptoms: ${symptoms.join(', ')}`);
    await new Promise(resolve => setTimeout(resolve, 400));

    const matches: { code: string; description: string; confidence: number }[] = [];
    const keywords = symptoms.map(s => s.toLowerCase());

    if (keywords.some(s => s.includes('fever') || s.includes('chills'))) {
      matches.push({ code: 'B34.9', description: 'Viral infection, unspecified', confidence: 0.85 });
    }
    if (keywords.some(s => s.includes('cough') || s.includes('throat'))) {
      matches.push({ code: 'J02.9', description: 'Acute pharyngitis, unspecified', confidence: 0.90 });
    }
    if (keywords.some(s => s.includes('headache') || s.includes('migraine'))) {
      matches.push({ code: 'G43.9', description: 'Migraine, unspecified', confidence: 0.78 });
    }

    if (!matches.length) {
      matches.push({ code: 'R69', description: 'Illness, unspecified symptoms', confidence: 0.50 });
    }

    return matches;
  }

  /**
   * Extracts structured medicine fields from a raw prescription note
   */
  public static async parsePrescriptionNote(note: string): Promise<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[]> {
    console.log(`[AI Service] Parsing prescription text: "${note}"`);
    await new Promise(resolve => setTimeout(resolve, 300));

    return [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '5 days',
        instructions: 'Take after meals'
      }
    ];
  }
}
export default AIService;
