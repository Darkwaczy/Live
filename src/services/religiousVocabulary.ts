export const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", 
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", 
  "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", 
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", 
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", 
  "1 John", "2 John", "3 John", "Jude", "Revelation"
];

export const BIBLE_CHARACTERS = [
  "Adam", "Eve", "Noah", "Abraham", "Isaac", "Jacob", "Joseph", "Moses", "Aaron", "Joshua", "Gideon", "Samson", "Samuel", "Saul", "David", "Solomon", 
  "Elijah", "Elisha", "Isaiah", "Jeremiah", "Daniel", "Nehemiah", "Esther", "Mary", "Joseph", "Jesus", "John the Baptist", "Peter", "Paul", "James", "John", 
  "Luke", "Matthew", "Mark", "Barnabas", "Silas", "Timothy", "Titus"
];

export const THEOLOGICAL_TERMS = [
  "Sanctification", "Redemption", "Justification", "Propitiation", "Glorification", "Ascension", "Resurrection", "Atonement", "Salvation", "Grace", "Mercy", 
  "Covenant", "Testament", "Omnipotent", "Omniscient", "Omnipresent", "Sovereignty", "Providence", "Righteousness", "Holiness", "Sin", "Repentance", 
  "Faith", "Belief", "Worship", "Prayer", "Fast", "Tithes", "Offering", "Baptism", "Communion", "Fellowship", "Ministry", "Apostleship", "Discipleship",
  "Immanuel", "Messiah", "Logos", "Alpha", "Omega", "Shekinah", "Yahweh", "Jehovah", "Elohim", "Adonai"
];

export const COMMON_PHRASES = [
  "Praise the Lord", "Hallelujah", "Amen", "In Jesus' name", "Glory to God", "The Word of God", "Second coming", "Great commission", "Body of Christ",
  "Holy Communion", "Water Baptism", "Holy Spirit", "Holy Ghost", "Cast out demons", "Healing and deliverance", "Fruit of the Spirit", "Gifts of the Spirit",
  "Old Testament", "New Testament", "Good News", "Gospel of Peace"
];

// Combine all for Deepgram Boosting (Limit to reasonable size for API efficiency)
export const DEEPGRAM_BOOST_LIST = [
  ...BIBLE_BOOKS,
  ...BIBLE_CHARACTERS.slice(0, 15),
  ...THEOLOGICAL_TERMS.slice(0, 20),
  ...COMMON_PHRASES.slice(0, 10)
].filter((item, index, self) => self.indexOf(item) === index);
