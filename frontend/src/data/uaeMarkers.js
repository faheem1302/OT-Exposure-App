const uaeMarkers = [
  // Dubai
  { id: 1,  name: "Burj Khalifa",              lat: 25.1972, lng: 55.2744, city: "Dubai",           category: "Landmark",  description: "World's tallest building at 828m" },
  { id: 2,  name: "Dubai Mall",                lat: 25.1985, lng: 55.2796, city: "Dubai",           category: "Shopping",  description: "One of the world's largest malls" },
  { id: 3,  name: "Palm Jumeirah",             lat: 25.1124, lng: 55.1390, city: "Dubai",           category: "Landmark",  description: "Iconic palm-shaped artificial island" },
  { id: 4,  name: "Dubai Marina",              lat: 25.0805, lng: 55.1403, city: "Dubai",           category: "District",  description: "Vibrant waterfront community" },
  { id: 5,  name: "Dubai Frame",               lat: 25.2354, lng: 55.3009, city: "Dubai",           category: "Landmark",  description: "Giant picture frame structure" },
  { id: 6,  name: "Gold Souk",                 lat: 25.2867, lng: 55.3058, city: "Dubai",           category: "Shopping",  description: "Traditional gold market in Deira" },
  { id: 7,  name: "Dubai Creek",               lat: 25.2632, lng: 55.3072, city: "Dubai",           category: "Nature",    description: "Historic saltwater creek" },
  { id: 8,  name: "Jumeirah Beach",            lat: 25.2048, lng: 55.2425, city: "Dubai",           category: "Nature",    description: "Popular public beach" },
  { id: 9,  name: "Museum of the Future",      lat: 25.2197, lng: 55.2814, city: "Dubai",           category: "Culture",   description: "Futuristic museum opened in 2022" },
  { id: 10, name: "Dubai Opera",               lat: 25.1958, lng: 55.2780, city: "Dubai",           category: "Culture",   description: "Dhow-shaped performing arts center" },

  // Abu Dhabi
  { id: 11, name: "Sheikh Zayed Grand Mosque", lat: 24.4128, lng: 54.4749, city: "Abu Dhabi",       category: "Culture",   description: "One of the world's largest mosques" },
  { id: 12, name: "Louvre Abu Dhabi",          lat: 24.5338, lng: 54.3983, city: "Abu Dhabi",       category: "Culture",   description: "Universal museum on Saadiyat Island" },
  { id: 13, name: "Emirates Palace",           lat: 24.4611, lng: 54.3172, city: "Abu Dhabi",       category: "Hotel",     description: "Iconic luxury hotel" },
  { id: 14, name: "Yas Island",                lat: 24.4867, lng: 54.6089, city: "Abu Dhabi",       category: "District",  description: "Entertainment and leisure destination" },
  { id: 15, name: "Ferrari World",             lat: 24.4834, lng: 54.6079, city: "Abu Dhabi",       category: "Landmark",  description: "World's largest indoor theme park" },
  { id: 16, name: "Abu Dhabi Corniche",        lat: 24.4742, lng: 54.3478, city: "Abu Dhabi",       category: "Nature",    description: "8km waterfront promenade" },
  { id: 17, name: "Qasr Al Hosn",              lat: 24.4831, lng: 54.3542, city: "Abu Dhabi",       category: "Culture",   description: "Oldest stone building in Abu Dhabi" },
  { id: 18, name: "Mangrove National Park",    lat: 24.4616, lng: 54.4345, city: "Abu Dhabi",       category: "Nature",    description: "Protected mangrove ecosystem" },
  { id: 19, name: "Warner Bros. World",        lat: 24.4843, lng: 54.6068, city: "Abu Dhabi",       category: "Landmark",  description: "Indoor theme park on Yas Island" },
  { id: 20, name: "Abu Dhabi Mall",            lat: 24.4952, lng: 54.3827, city: "Abu Dhabi",       category: "Shopping",  description: "Major shopping center" },

  // Sharjah
  { id: 21, name: "Museum of Islamic Civilization", lat: 25.3575, lng: 55.3887, city: "Sharjah",   category: "Culture",   description: "Showcases Islamic art and science" },
  { id: 22, name: "Al Noor Island",            lat: 25.3516, lng: 55.4012, city: "Sharjah",         category: "Nature",    description: "Beautiful island with butterfly house" },
  { id: 23, name: "Sharjah Art Museum",        lat: 25.3576, lng: 55.3896, city: "Sharjah",         category: "Culture",   description: "Largest art museum in the Gulf" },
  { id: 24, name: "Al Qasba",                  lat: 25.3284, lng: 55.3920, city: "Sharjah",         category: "District",  description: "Waterfront entertainment district" },
  { id: 25, name: "Sharjah Aquarium",          lat: 25.3624, lng: 55.4055, city: "Sharjah",         category: "Landmark",  description: "Marine life exhibits" },

  // Ajman
  { id: 26, name: "Ajman Museum",              lat: 25.4116, lng: 55.4352, city: "Ajman",           category: "Culture",   description: "Housed in an 18th-century fort" },
  { id: 27, name: "Ajman Corniche",            lat: 25.4049, lng: 55.4389, city: "Ajman",           category: "Nature",    description: "Scenic beachfront promenade" },
  { id: 28, name: "Ajman City Centre",         lat: 25.4071, lng: 55.4458, city: "Ajman",           category: "Shopping",  description: "Main shopping mall in Ajman" },

  // Ras Al Khaimah
  { id: 29, name: "Jebel Jais",                lat: 25.9551, lng: 56.1036, city: "Ras Al Khaimah",  category: "Nature",    description: "UAE's highest peak at 1,934m" },
  { id: 30, name: "RAK National Museum",       lat: 25.7904, lng: 55.9432, city: "Ras Al Khaimah",  category: "Culture",   description: "Historic fort turned museum" },
  { id: 31, name: "Al Hamra Mall",             lat: 25.6890, lng: 55.7820, city: "Ras Al Khaimah",  category: "Shopping",  description: "Beachfront shopping destination" },
  { id: 32, name: "Dhayah Fort",               lat: 25.8344, lng: 55.9186, city: "Ras Al Khaimah",  category: "Culture",   description: "Ancient hilltop fort" },
  { id: 33, name: "Marjan Island",             lat: 25.6629, lng: 55.7629, city: "Ras Al Khaimah",  category: "District",  description: "Man-made island resort destination" },

  // Fujairah
  { id: 34, name: "Fujairah Fort",             lat: 25.1249, lng: 56.3441, city: "Fujairah",        category: "Culture",   description: "Oldest fort in the UAE" },
  { id: 35, name: "Al Bidyah Mosque",          lat: 25.2877, lng: 56.3621, city: "Fujairah",        category: "Culture",   description: "Oldest mosque in the UAE" },
  { id: 36, name: "Snoopy Island",             lat: 25.5101, lng: 56.3501, city: "Fujairah",        category: "Nature",    description: "Famous snorkeling spot" },
  { id: 37, name: "Fujairah Corniche",         lat: 25.1216, lng: 56.3391, city: "Fujairah",        category: "Nature",    description: "East coast beachfront" },
  { id: 38, name: "Wadi Wurayah",              lat: 25.3012, lng: 56.2234, city: "Fujairah",        category: "Nature",    description: "First mountain national park in UAE" },

  // Umm Al Quwain
  { id: 39, name: "Dreamland Aqua Park",       lat: 25.5672, lng: 55.5541, city: "Umm Al Quwain",  category: "Landmark",  description: "Largest water park in the Middle East" },
  { id: 40, name: "UAQ Marine Club",           lat: 25.5648, lng: 55.5518, city: "Umm Al Quwain",  category: "Nature",    description: "Watersports and marine activities" },
  { id: 41, name: "UAQ Old Town",              lat: 25.5655, lng: 55.5571, city: "Umm Al Quwain",  category: "Culture",   description: "Historic fishing village area" },

  // More Dubai
  { id: 42, name: "Global Village",            lat: 25.0689, lng: 55.3069, city: "Dubai",           category: "Culture",   description: "Multicultural festival park" },
  { id: 43, name: "Dubai Miracle Garden",      lat: 25.0612, lng: 55.2714, city: "Dubai",           category: "Nature",    description: "World's largest natural flower garden" },
  { id: 44, name: "The Dubai Fountain",        lat: 25.1956, lng: 55.2747, city: "Dubai",           category: "Landmark",  description: "World's largest choreographed fountain" },
  { id: 45, name: "Deira City Centre",         lat: 25.2523, lng: 55.3298, city: "Dubai",           category: "Shopping",  description: "Classic Dubai shopping mall" },
  { id: 46, name: "Al Fahidi Historic District", lat: 25.2635, lng: 55.2979, city: "Dubai",         category: "Culture",   description: "Preserved old Dubai neighborhood" },
  { id: 47, name: "Dubai Aquarium",            lat: 25.1981, lng: 55.2798, city: "Dubai",           category: "Landmark",  description: "One of the world's largest aquariums" },

  // More Abu Dhabi
  { id: 48, name: "Yas Marina Circuit",        lat: 24.4672, lng: 54.6031, city: "Abu Dhabi",       category: "Landmark",  description: "Formula 1 Grand Prix circuit" },
  { id: 49, name: "Sir Bani Yas Island",       lat: 24.0127, lng: 52.6197, city: "Abu Dhabi",       category: "Nature",    description: "Wildlife reserve island" },
  { id: 50, name: "Zayed National Museum",     lat: 24.5412, lng: 54.4330, city: "Abu Dhabi",       category: "Culture",   description: "Dedicated to UAE's founding father" },
];

export default uaeMarkers;
