export const NIGERIAN_VOCABULARY = [
  "Wetin", "Wetin dey happen", "Abeg", "Wahala", "Oga", "Sharp-sharp", 
  "Pikin", "Sabi", "Mumu", "Chop", "Una", "Dia", "Oyo", "Yanga", 
  "Magun", "Japa", "Gbosa", "Gbege", "Kuku", "At all at all"
];

export const NIGERIAN_PRIME_PROMPT = `
This is a Nigerian Christian sermon. 
Expect thick Nigerian accents and Nigerian Pidgin English. 
Key phrases to look for: ${NIGERIAN_VOCABULARY.join(', ')}.
Transcribe exactly what is spoken in Pidgin/English. 
If the user says something that sounds like "curb", check if they mean "come" or "club" in the context of a gathering.
`;
