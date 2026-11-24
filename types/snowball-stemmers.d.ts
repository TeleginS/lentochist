declare module 'snowball-stemmers' {
  interface Stemmer {
    stem(word: string): string;
  }
  const factory: {
    newStemmer(algorithm: string): Stemmer;
    algorithms(): string[];
  };
  export default factory;
}
