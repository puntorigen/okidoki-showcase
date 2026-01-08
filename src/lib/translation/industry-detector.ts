/**
 * Industry Detector
 * Analyzes document content to detect industry/domain for appropriate terminology.
 */

import { IndustryType, IndustryDetectionResult } from './translation-types';

// Keywords that indicate specific industries
const INDUSTRY_KEYWORDS: Record<IndustryType, string[]> = {
  legal: [
    'agreement', 'contract', 'party', 'parties', 'whereas', 'hereby', 'thereof',
    'indemnify', 'liability', 'jurisdiction', 'arbitration', 'confidential',
    'intellectual property', 'warranty', 'termination', 'breach', 'damages',
    'contrato', 'acuerdo', 'partes', 'cláusula', 'jurisdicción', 'responsabilidad',
  ],
  medical: [
    'patient', 'diagnosis', 'treatment', 'medication', 'symptoms', 'clinical',
    'hospital', 'physician', 'prescription', 'dosage', 'contraindication',
    'paciente', 'diagnóstico', 'tratamiento', 'medicamento', 'síntomas', 'clínico',
  ],
  technical: [
    'software', 'hardware', 'system', 'database', 'api', 'server', 'cloud',
    'algorithm', 'interface', 'protocol', 'encryption', 'deployment', 'architecture',
    'sistema', 'servidor', 'base de datos', 'algoritmo', 'protocolo', 'cifrado',
  ],
  financial: [
    'investment', 'portfolio', 'dividend', 'equity', 'asset', 'liability',
    'revenue', 'profit', 'margin', 'fiscal', 'quarterly', 'shareholder',
    'inversión', 'cartera', 'dividendo', 'activo', 'pasivo', 'ingresos', 'beneficio',
  ],
  marketing: [
    'campaign', 'brand', 'audience', 'engagement', 'conversion', 'roi',
    'analytics', 'demographic', 'customer journey', 'funnel', 'retention',
    'campaña', 'marca', 'audiencia', 'conversión', 'retención', 'cliente',
  ],
  academic: [
    'research', 'study', 'hypothesis', 'methodology', 'findings', 'conclusion',
    'abstract', 'references', 'literature', 'thesis', 'dissertation', 'peer review',
    'investigación', 'estudio', 'hipótesis', 'metodología', 'conclusión', 'tesis',
  ],
  general: [],
};

// Industry-specific terminology differences
export const INDUSTRY_TERMINOLOGY: Record<IndustryType, Record<string, Record<string, string>>> = {
  legal: {
    'consideration': { es: 'contraprestación', fr: 'contrepartie' },
    'party': { es: 'parte', fr: 'partie' },
    'agreement': { es: 'acuerdo', fr: 'accord' },
    'whereas': { es: 'considerando que', fr: 'attendu que' },
    'herein': { es: 'en el presente', fr: 'aux présentes' },
    'thereof': { es: 'del mismo', fr: 'de celui-ci' },
  },
  medical: {
    'patient': { es: 'paciente', fr: 'patient' },
    'treatment': { es: 'tratamiento', fr: 'traitement' },
    'diagnosis': { es: 'diagnóstico', fr: 'diagnostic' },
    'prescription': { es: 'receta', fr: 'ordonnance' },
  },
  technical: {
    'deploy': { es: 'desplegar', fr: 'déployer' },
    'implementation': { es: 'implementación', fr: 'implémentation' },
    'interface': { es: 'interfaz', fr: 'interface' },
    'database': { es: 'base de datos', fr: 'base de données' },
  },
  financial: {
    'asset': { es: 'activo', fr: 'actif' },
    'liability': { es: 'pasivo', fr: 'passif' },
    'revenue': { es: 'ingresos', fr: 'revenus' },
    'equity': { es: 'patrimonio', fr: 'capitaux propres' },
  },
  marketing: {
    'campaign': { es: 'campaña', fr: 'campagne' },
    'brand': { es: 'marca', fr: 'marque' },
    'engagement': { es: 'interacción', fr: 'engagement' },
    'conversion': { es: 'conversión', fr: 'conversion' },
  },
  academic: {
    'research': { es: 'investigación', fr: 'recherche' },
    'hypothesis': { es: 'hipótesis', fr: 'hypothèse' },
    'methodology': { es: 'metodología', fr: 'méthodologie' },
    'findings': { es: 'hallazgos', fr: 'résultats' },
  },
  general: {},
};

export class IndustryDetector {
  /**
   * Detect industry from document text using keyword analysis
   * Fast, local detection without API calls
   */
  detectFromKeywords(documentText: string): IndustryDetectionResult {
    const textLower = documentText.toLowerCase();
    const scores: Record<IndustryType, { count: number; keywords: string[] }> = {
      legal: { count: 0, keywords: [] },
      medical: { count: 0, keywords: [] },
      technical: { count: 0, keywords: [] },
      financial: { count: 0, keywords: [] },
      marketing: { count: 0, keywords: [] },
      academic: { count: 0, keywords: [] },
      general: { count: 0, keywords: [] },
    };

    // Count keyword matches for each industry
    for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
        const matches = textLower.match(regex);
        if (matches) {
          scores[industry as IndustryType].count += matches.length;
          if (!scores[industry as IndustryType].keywords.includes(keyword)) {
            scores[industry as IndustryType].keywords.push(keyword);
          }
        }
      }
    }

    // Find the industry with the highest score
    let maxScore = 0;
    let detectedIndustry: IndustryType = 'general';
    let matchedKeywords: string[] = [];

    for (const [industry, data] of Object.entries(scores)) {
      if (data.count > maxScore) {
        maxScore = data.count;
        detectedIndustry = industry as IndustryType;
        matchedKeywords = data.keywords;
      }
    }

    // Calculate confidence based on keyword density
    const wordCount = documentText.split(/\s+/).length;
    const confidence = Math.min(1, maxScore / Math.max(1, wordCount / 100));

    return {
      industry: detectedIndustry,
      confidence,
      keywords: matchedKeywords.slice(0, 10),
    };
  }

  /**
   * Detect industry using AI for more accurate classification
   * Use when higher accuracy is needed
   */
  async detectWithAI(
    documentText: string,
    widget: any
  ): Promise<IndustryDetectionResult> {
    // First, do a quick keyword-based detection
    const keywordResult = this.detectFromKeywords(documentText);
    
    // If confidence is high enough, use keyword result
    if (keywordResult.confidence > 0.7) {
      return keywordResult;
    }

    // Otherwise, use AI for better classification
    try {
      const result = await widget.ask({
        prompt: `Classify this document into ONE of these industries:
- legal (contracts, agreements, legal documents)
- medical (healthcare, clinical, pharmaceutical)
- technical (software, engineering, IT)
- financial (banking, investment, accounting)
- marketing (advertising, branding, sales)
- academic (research, educational, scientific)
- general (none of the above)

Analyze the content and terminology to determine the best fit.`,
        context: `DOCUMENT TEXT (first 3000 chars):
${documentText.substring(0, 3000)}`,
        output: {
          industry: widget.helpers.select(
            ['legal', 'medical', 'technical', 'financial', 'marketing', 'academic', 'general'],
            'The detected industry'
          ),
          confidence: widget.helpers.number('Confidence score from 0 to 1'),
          keywords: widget.helpers.array(
            widget.helpers.string('Key terms that indicate this industry')
          ),
        },
      });

      if (result.success && result.result) {
        return {
          industry: result.result.industry as IndustryType,
          confidence: result.result.confidence,
          keywords: result.result.keywords.slice(0, 10),
        };
      }
    } catch (error) {
      console.warn('[IndustryDetector] AI detection failed, using keyword result:', error);
    }

    // Fallback to keyword result
    return keywordResult;
  }

  /**
   * Get industry-specific terminology for translation prompts
   */
  getIndustryTerminology(
    industry: IndustryType,
    targetLanguage: string
  ): Record<string, string> {
    const terminology = INDUSTRY_TERMINOLOGY[industry] || {};
    const result: Record<string, string> = {};

    // Get the language code (first 2 chars)
    const langCode = targetLanguage.substring(0, 2).toLowerCase();

    for (const [term, translations] of Object.entries(terminology)) {
      if (translations[langCode]) {
        result[term] = translations[langCode];
      }
    }

    return result;
  }
}

// Singleton instance
export const industryDetector = new IndustryDetector();
