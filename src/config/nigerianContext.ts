export const NIGERIAN_PIDGIN = [
  "Wetin", "Wetin dey", "Wetin dey do", "Wetin dey happen", "Abeg", "Wahala", "Oga", "Sharp-sharp", 
  "Pikin", "Sabi", "Mumu", "Chop", "Una", "Dia", "Oyo", "Yanga", 
  "Japa", "Gbosa", "Gbege", "Kuku", "At all at all", "Inside", "Outside",
  "Commot", "Vex", "Club", "Waka", "Gat", "Don", "Ooo", "Ah-ah", "Nne", "Nna",
  "Odogwu", "Okwute", "imela", "shutup", "oluku", "Oluwa",  "Shey", "Abi", "Baami", "Omo", "Maami", "Oshey", "Eku-se", "Eku-kale",
  "Oya", "Shara", "Inside", "Outside", "Gat", "Fit", "Dem", "Dey", "Go",
  "Come", "Make", "Say", "Talk", "I never", "I don", "I de", "I dey",
  "Wobia", "Olofofo", "Yeye", "Banza", "Waka", "Lamba", "Tanda", "Quench",
  "Oburo", "Wayas", "Yawa", "Leg", "Hand", "Mouth", "Eye", "Ear", "Head",
  "Leg-go", "Waka-come", "Santi", "Ova", "Dey-go", "No-viva", "Gbas-gbos"
];

export const CHURCH_TERMS = [
  "Hallelujah", "Amen", "Glory", "Anointing", "Bishop", "Prophet", 
  "Apostle", "Evangelist", "Brother", "Sister", "Pastor", "Preacher", 
  "Faith", "Grace", "Mercy", "Blessing", "Salvation", "Redemption", 
  "Covenant", "Holy Spirit", "Jesus", "Christ", "Father", "Lord", 
  "Testimony", "Prayer", "Worship", "Praise", "Glory be to God",
  "In Jesus name", "Praise the Lord", "Let us pray", "The Word of God",
  "Ekwueme", "Arugbo Ojo", "Oba", "Chineke", "Olowogbogboro", 
  "Ebenezer", "Jehovah", "Yahweh", "Elohim", "Hosanna", "Shalom", 
  "Maranatha", "Shiloh", "Peniel", "Bethel", "Mount Zion", "Tabernacle",
  "Sanctuary", "Altar", "Tithe", "Offering", "Seed", "Firstfruit",
  "Harvest", "Dominion", "Victory", "Conqueror", "Overcomer", "Deliverance",
  "Miracle", "Sign", "Wonder", "Prophecy", "Revelation", "Spirit-filled",
  "Tongues", "Interpretation", "Intercession", "Kingdom", "Righteousness",
  "Holiness", "Consecration", "Sovereign", "Omnipotent", "Omniscient",
  "Omnipresent", "Alpha", "Omega", "Beginning", "End", "Lion of Judah",
  "Rose of Sharon", "Lily of the Valley", "Prince of Peace", "King of Kings"
];

export const NIGERIAN_VOCABULARY = [...NIGERIAN_PIDGIN, ...CHURCH_TERMS];

export const NIGERIAN_PRIME_PROMPT = `
This is a Nigerian Christian sermon. 
Expect thick Nigerian accents and Nigerian Pidgin English. 
Key phrases to look for: ${NIGERIAN_VOCABULARY.join(', ')}.
Transcribe exactly what is spoken in Pidgin/English. 
If the user says something that sounds like "curb", check if they mean "come" or "club" in the context of a gathering.
`;
