export const NIGERIAN_VOCABULARY = [
  "Wetin", "Wetin dey happen", "Abeg", "Wahala", "Oga", "Sharp-sharp", 
  "Pikin", "Sabi", "Mumu", "Chop", "Una", "Dia", "Oyo", "Yanga", 
  "Japa", "Gbosa", "Gbege", "Kuku", "At all at all", "Inside", 
  "Commot", "Vex", "Waka", "Gat", "Don", "Ooo", "Ah-ah", "Kuku", 
  "Ekwueme", "Arugbo Ojo", "Oba", "Chineke", "Olowogbogboro", 
  "Ebenezer", "Jehovah", "Yahweh", "Elohim", "Hallelujah", "Hosanna", 
  "Shalom", "Maranatha", "Amen", "Glory", "Anointing", "Bishop", 
  "Prophet", "Apostle", "Evangelist", "Brother", "Sister", "Pastor", 
  "Preacher", "Faith", "Grace", "Mercy", "Blessing", "Salvation", 
  "Redemption", "Covenant", "Holy Spirit", "Jesus", "Christ", "Father", 
  "Lord", "Testimony", "Prayer", "Worship", "Praise", "Glory be to God",
  "In Jesus name", "Praise the Lord", "Let us pray", "The Word of God"
];

export const NIGERIAN_PRIME_PROMPT = `
This is a Nigerian Christian sermon. 
Expect thick Nigerian accents and Nigerian Pidgin English. 
Key phrases to look for: ${NIGERIAN_VOCABULARY.join(', ')}.
Transcribe exactly what is spoken in Pidgin/English. 
If the user says something that sounds like "curb", check if they mean "come" or "club" in the context of a gathering.
`;
