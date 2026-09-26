/**
 * Layer 1 of the analysis stack — TF-IDF weighting + cosine similarity.
 *
 * Why not plain word overlap? A maintenance corpus is full of low-information
 * verbs ("replaced", "checked", "inspected") that appear in almost every record,
 * so a Jaccard overlap scores two unrelated jobs as similar just because both
 * used the word "replaced". TF-IDF down-weights terms that are common across
 * the corpus and up-weights discriminative ones — "spindle", "chatter",
 * "coolant" — which is what actually separates one failure mode from another.
 *
 * Pure TypeScript, zero dependencies, deterministic: the same corpus and query
 * always produce the same ranking.
 */
import { normalizeTokens } from '../../utils/helpers';

export interface TfidfModel {
  /** Number of documents that contributed at least one token. */
  documentCount: number;
  /** Vocabulary, insertion-ordered so indices are stable across runs. */
  vocabulary: string[];
  /** term -> column index in every vector produced by this model. */
  termIndex: Record<string, number>;
  /** term -> number of documents containing it. */
  documentFrequency: Record<string, number>;
  /** term -> idf, precomputed as ln((1 + n) / (1 + df)) + 1. */
  idf: Record<string, number>;
}

export interface Corpus {
  model: TfidfModel;
  /** L2-normalised TF-IDF vector for each input document, same order. */
  vectors: number[][];
}

function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
}

/** Builds the vocabulary and idf table from a document collection. */
export function buildTfidfModel(texts: string[]): TfidfModel {
  const documentFrequency: Record<string, number> = {};
  const vocabulary: string[] = [];
  const termIndex: Record<string, number> = {};
  let documentCount = 0;

  for (const text of texts) {
    // Duplicate tokens inside one record must not inflate its document frequency.
    const uniqueTokens = new Set(normalizeTokens(text));
    if (uniqueTokens.size === 0) continue;
    documentCount += 1;
    for (const token of uniqueTokens) {
      if (documentFrequency[token] === undefined) {
        documentFrequency[token] = 0;
        termIndex[token] = vocabulary.length;
        vocabulary.push(token);
      }
      documentFrequency[token] += 1;
    }
  }

  const idf: Record<string, number> = {};
  for (const term of vocabulary) {
    idf[term] = Math.log((1 + documentCount) / (1 + documentFrequency[term])) + 1;
  }

  return { documentCount, vocabulary, termIndex, documentFrequency, idf };
}

/** Maps free text to an L2-normalised TF-IDF vector in model space. */
export function vectorize(model: TfidfModel, text: string): number[] {
  const vector = new Array<number>(model.vocabulary.length).fill(0);
  const termCounts: Record<string, number> = {};

  for (const token of normalizeTokens(text)) {
    termCounts[token] = (termCounts[token] || 0) + 1;
  }

  for (const term of Object.keys(termCounts)) {
    const index = model.termIndex[term];
    if (index === undefined) continue; // out-of-vocabulary -> ignored, not an error
    vector[index] = termCounts[term] * model.idf[term];
  }

  return l2Normalize(vector);
}

/** Cosine similarity between two vectors (handles un-normalised inputs). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Vectorises a document collection once so rankings do not rebuild it per query. */
export function buildCorpus(texts: string[]): Corpus {
  const model = buildTfidfModel(texts);
  return { model, vectors: texts.map((text) => vectorize(model, text)) };
}

/**
 * Similarity between two short texts using the same TF-IDF/cosine method as
 * Layer 1, so the whole system scores text one way instead of mixing metrics.
 *
 * The corpus is the pair itself: terms shared by both documents carry full
 * weight, while terms unique to one side are up-weighted and therefore lower
 * the cosine score. Identical texts always score exactly 1.
 */
export function textSimilarity(left: string, right: string): number {
  const corpus = buildCorpus([left, right]);
  return cosineSimilarity(corpus.vectors[0], corpus.vectors[1]);
}

export interface RankedMatch {
  /** Index into the corpus that was passed to buildCorpus. */
  index: number;
  /** Cosine similarity in [0, 1]. */
  similarity: number;
}

/**
 * Ranks every corpus document against a query, descending by similarity.
 * Documents with zero overlap are dropped rather than reported as 0.0 matches,
 * because a "no evidence" result must look different from a weak one.
 */
export function rankCorpus(corpus: Corpus, query: string, options: { minSimilarity?: number } = {}): RankedMatch[] {
  const queryVector = vectorize(corpus.model, query);
  const minSimilarity = options.minSimilarity ?? 0;

  const ranked: RankedMatch[] = [];
  for (let index = 0; index < corpus.vectors.length; index += 1) {
    const similarity = cosineSimilarity(queryVector, corpus.vectors[index]);
    if (similarity > minSimilarity) {
      ranked.push({ index, similarity: Math.round(similarity * 1000) / 1000 });
    }
  }

  return ranked.sort((a, b) => b.similarity - a.similarity);
}
