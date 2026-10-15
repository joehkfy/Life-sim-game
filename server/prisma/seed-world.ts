/**
 * Big world seed: 60+ countries × 15 states × cities.
 * Only the player's current city is rendered in 3D — this data powers map / travel / create.
 */
import { PrismaClient } from "@prisma/client";
import { seedTravel } from "./seedJobsAndTravel";

const prisma = new PrismaClient();

type CDef = {
  code: string;
  name: string;
  flag: string;
  currencyCode: string;
  currencySymbol: string;
  exchangeToUsd: number;
  mapX: number;
  mapY: number;
  /** Real or plausible state/region names (padded to 15+) */
  states: string[];
  /** Capital / major city name used as first city in first state */
  capital: string;
};

const COUNTRIES: CDef[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currencyCode: "NGN", currencySymbol: "₦", exchangeToUsd: 0.00065, mapX: 52, mapY: 54, capital: "Abuja",
    states: ["Lagos","Abuja FCT","Rivers","Kano","Oyo","Kaduna","Delta","Ogun","Anambra","Enugu","Imo","Edo","Plateau","Sokoto","Borno","Akwa Ibom"] },
  { code: "US", name: "United States", flag: "🇺🇸", currencyCode: "USD", currencySymbol: "$", exchangeToUsd: 1, mapX: 22, mapY: 38, capital: "Washington",
    states: ["California","Texas","New York","Florida","Illinois","Pennsylvania","Ohio","Georgia","North Carolina","Michigan","New Jersey","Virginia","Washington","Arizona","Massachusetts","Colorado"] },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currencyCode: "GBP", currencySymbol: "£", exchangeToUsd: 1.27, mapX: 48, mapY: 32, capital: "London",
    states: ["England","Scotland","Wales","Northern Ireland","Greater London","West Midlands","North West","Yorkshire","South East","South West","East of England","East Midlands","North East","Central Scotland","South Wales","Ulster"] },
  { code: "JP", name: "Japan", flag: "🇯🇵", currencyCode: "JPY", currencySymbol: "¥", exchangeToUsd: 0.0067, mapX: 82, mapY: 40, capital: "Tokyo",
    states: ["Tokyo","Osaka","Kanagawa","Aichi","Hokkaido","Fukuoka","Hyogo","Kyoto","Saitama","Chiba","Hiroshima","Miyagi","Niigata","Shizuoka","Okayama","Kumamoto"] },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currencyCode: "BRL", currencySymbol: "R$", exchangeToUsd: 0.18, mapX: 32, mapY: 68, capital: "Brasília",
    states: ["São Paulo","Rio de Janeiro","Minas Gerais","Bahia","Paraná","Rio Grande do Sul","Pernambuco","Ceará","Pará","Santa Catarina","Goiás","Maranhão","Amazonas","Espírito Santo","Paraíba","Federal District"] },
  { code: "IN", name: "India", flag: "🇮🇳", currencyCode: "INR", currencySymbol: "₹", exchangeToUsd: 0.012, mapX: 68, mapY: 48, capital: "New Delhi",
    states: ["Maharashtra","Uttar Pradesh","Karnataka","Tamil Nadu","Gujarat","West Bengal","Rajasthan","Kerala","Telangana","Madhya Pradesh","Andhra Pradesh","Bihar","Punjab","Haryana","Delhi","Odisha"] },
  { code: "DE", name: "Germany", flag: "🇩🇪", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 51, mapY: 30, capital: "Berlin",
    states: ["Bavaria","North Rhine-Westphalia","Baden-Württemberg","Lower Saxony","Hesse","Saxony","Rhineland-Palatinate","Berlin","Schleswig-Holstein","Brandenburg","Saxony-Anhalt","Thuringia","Hamburg","Mecklenburg-Vorpommern","Saarland","Bremen"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currencyCode: "ZAR", currencySymbol: "R", exchangeToUsd: 0.055, mapX: 55, mapY: 78, capital: "Pretoria",
    states: ["Gauteng","Western Cape","KwaZulu-Natal","Eastern Cape","Limpopo","Mpumalanga","North West","Free State","Northern Cape","Johannesburg Metro","Cape Town Metro","Durban Metro","Pretoria Region","Port Elizabeth","Bloemfontein","Polokwane"] },
  { code: "AU", name: "Australia", flag: "🇦🇺", currencyCode: "AUD", currencySymbol: "A$", exchangeToUsd: 0.66, mapX: 85, mapY: 75, capital: "Canberra",
    states: ["New South Wales","Victoria","Queensland","Western Australia","South Australia","Tasmania","Northern Territory","Australian Capital Territory","Sydney Metro","Melbourne Metro","Brisbane Metro","Perth Metro","Adelaide Metro","Gold Coast","Newcastle","Hobart"] },
  { code: "CA", name: "Canada", flag: "🇨🇦", currencyCode: "CAD", currencySymbol: "C$", exchangeToUsd: 0.74, mapX: 20, mapY: 28, capital: "Ottawa",
    states: ["Ontario","Quebec","British Columbia","Alberta","Manitoba","Saskatchewan","Nova Scotia","New Brunswick","Newfoundland","Prince Edward Island","Northwest Territories","Yukon","Nunavut","Toronto Metro","Montreal Metro","Vancouver Metro"] },
  { code: "FR", name: "France", flag: "🇫🇷", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 49, mapY: 34, capital: "Paris",
    states: ["Île-de-France","Auvergne-Rhône-Alpes","Nouvelle-Aquitaine","Occitanie","Hauts-de-France","Provence-Alpes-Côte d'Azur","Grand Est","Pays de la Loire","Brittany","Normandy","Bourgogne-Franche-Comté","Centre-Val de Loire","Corsica","Paris Metro","Lyon Metro","Marseille Metro"] },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currencyCode: "AED", currencySymbol: "د.إ", exchangeToUsd: 0.27, mapX: 62, mapY: 46, capital: "Abu Dhabi",
    states: ["Abu Dhabi","Dubai","Sharjah","Ajman","Umm Al Quwain","Ras Al Khaimah","Fujairah","Al Ain","Dubai Marina","Downtown Dubai","Yas Island","Jebel Ali","Al Qudra","Liwa","Kalba","Dibba"] },
  { code: "CN", name: "China", flag: "🇨🇳", currencyCode: "CNY", currencySymbol: "¥", exchangeToUsd: 0.14, mapX: 75, mapY: 42, capital: "Beijing",
    states: ["Beijing","Shanghai","Guangdong","Zhejiang","Jiangsu","Sichuan","Hubei","Henan","Shandong","Fujian","Hunan","Anhui","Liaoning","Shaanxi","Chongqing","Tianjin"] },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currencyCode: "MXN", currencySymbol: "Mex$", exchangeToUsd: 0.05, mapX: 18, mapY: 48, capital: "Mexico City",
    states: ["Mexico City","Jalisco","Nuevo León","Puebla","Guanajuato","Veracruz","Yucatán","Quintana Roo","Baja California","Chihuahua","Michocán","Oaxaca","Chiapas","Tamaulipas","Sinaloa","Coahuila"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currencyCode: "KES", currencySymbol: "KSh", exchangeToUsd: 0.0077, mapX: 58, mapY: 58, capital: "Nairobi",
    states: ["Nairobi","Mombasa","Kiambu","Nakuru","Kisumu","Uasin Gishu","Machakos","Kajiado","Kilifi","Nyeri","Meru","Kakamega","Bungoma","Kilifi Coast","Laikipia","Narok"] },
  { code: "EG", name: "Egypt", flag: "🇪🇬", currencyCode: "EGP", currencySymbol: "E£", exchangeToUsd: 0.02, mapX: 56, mapY: 44, capital: "Cairo",
    states: ["Cairo","Giza","Alexandria","Sharqia","Dakahlia","Beheira","Qalyubia","Minya","Sohag","Asyut","Faiyum","Beni Suef","Aswan","Luxor","Port Said","Suez"] },
  { code: "KR", name: "South Korea", flag: "🇰🇷", currencyCode: "KRW", currencySymbol: "₩", exchangeToUsd: 0.00074, mapX: 80, mapY: 38, capital: "Seoul",
    states: ["Seoul","Busan","Incheon","Daegu","Daejeon","Gwangju","Ulsan","Gyeonggi","Gangwon","North Chungcheong","South Chungcheong","North Jeolla","South Jeolla","North Gyeongsang","South Gyeongsang","Jeju"] },
  { code: "IT", name: "Italy", flag: "🇮🇹", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 52, mapY: 36, capital: "Rome",
    states: ["Lazio","Lombardy","Campania","Sicily","Veneto","Emilia-Romagna","Piedmont","Apulia","Tuscany","Calabria","Sardinia","Liguria","Marche","Abruzzo","Friuli","Trentino"] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currencyCode: "GHS", currencySymbol: "GH₵", exchangeToUsd: 0.065, mapX: 48, mapY: 54, capital: "Accra",
    states: ["Greater Accra","Ashanti","Western","Eastern","Central","Northern","Volta","Upper East","Upper West","Bono","Bono East","Ahafo","Oti","Western North","North East","Savannah"] },
  { code: "SG", name: "Singapore", flag: "🇸🇬", currencyCode: "SGD", currencySymbol: "S$", exchangeToUsd: 0.74, mapX: 74, mapY: 58, capital: "Singapore",
    states: ["Central","East","North","North-East","West","Orchard","Marina Bay","Jurong","Woodlands","Tampines","Bedok","Clementi","Bukit Timah","Sentosa","Changi","Punggol"] },
  { code: "ES", name: "Spain", flag: "🇪🇸", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 46, mapY: 38, capital: "Madrid",
    states: ["Madrid","Catalonia","Andalusia","Valencia","Galicia","Basque Country","Castile and León","Castilla-La Mancha","Canary Islands","Murcia","Aragon","Extremadura","Balearic Islands","Asturias","Navarre","Cantabria"] },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 50, mapY: 30, capital: "Amsterdam",
    states: ["North Holland","South Holland","Utrecht","Gelderland","North Brabant","Overijssel","Limburg","Friesland","Groningen","Drenthe","Flevoland","Zeeland","Amsterdam Metro","Rotterdam Metro","The Hague","Utrecht City"] },
  { code: "SE", name: "Sweden", flag: "🇸🇪", currencyCode: "SEK", currencySymbol: "kr", exchangeToUsd: 0.095, mapX: 53, mapY: 22, capital: "Stockholm",
    states: ["Stockholm","Västra Götaland","Skåne","Östergötland","Uppsala","Jönköping","Halland","Örebro","Södermanland","Dalarna","Gävleborg","Värmland","Västmanland","Västerbotten","Norrbotten","Kalmar"] },
  { code: "NO", name: "Norway", flag: "🇳🇴", currencyCode: "NOK", currencySymbol: "kr", exchangeToUsd: 0.092, mapX: 52, mapY: 20, capital: "Oslo",
    states: ["Oslo","Viken","Vestland","Rogaland","Trøndelag","Innlandet","Agder","Troms og Finnmark","Møre og Romsdal","Nordland","Vestfold og Telemark","Oslo Metro","Bergen","Stavanger","Trondheim","Tromsø"] },
  { code: "PL", name: "Poland", flag: "🇵🇱", currencyCode: "PLN", currencySymbol: "zł", exchangeToUsd: 0.25, mapX: 54, mapY: 30, capital: "Warsaw",
    states: ["Masovia","Silesia","Greater Poland","Lesser Poland","Lower Silesia","Łódź","Pomerania","Lublin","Podkarpackie","West Pomerania","Kuyavia","Warmia-Masuria","Świętokrzyskie","Podlaskie","Opole","Lubusz"] },
  { code: "TR", name: "Turkey", flag: "🇹🇷", currencyCode: "TRY", currencySymbol: "₺", exchangeToUsd: 0.029, mapX: 58, mapY: 40, capital: "Ankara",
    states: ["Istanbul","Ankara","Izmir","Bursa","Antalya","Adana","Konya","Gaziantep","Şanlıurfa","Kocaeli","Mersin","Diyarbakır","Hatay","Manisa","Kayseri","Samsun"] },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", currencyCode: "SAR", currencySymbol: "﷼", exchangeToUsd: 0.27, mapX: 60, mapY: 48, capital: "Riyadh",
    states: ["Riyadh","Makkah","Eastern Province","Madinah","Asir","Jazan","Tabuk","Qassim","Hail","Najran","Al Bahah","Northern Borders","Al Jawf","Jeddah","Dammam","Taif"] },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currencyCode: "IDR", currencySymbol: "Rp", exchangeToUsd: 0.000063, mapX: 78, mapY: 62, capital: "Jakarta",
    states: ["Jakarta","West Java","East Java","Central Java","North Sumatra","Banten","South Sulawesi","Lampung","South Sumatra","Riau","Bali","West Kalimantan","East Kalimantan","Papua","Aceh","Yogyakarta"] },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currencyCode: "PHP", currencySymbol: "₱", exchangeToUsd: 0.017, mapX: 80, mapY: 52, capital: "Manila",
    states: ["Metro Manila","Cebu","Davao","Laguna","Cavite","Bulacan","Rizal","Pampanga","Batangas","Negros Occidental","Pangasinan","Iloilo","Quezon","Nueva Ecija","Zamboanga","Bohol"] },
  { code: "TH", name: "Thailand", flag: "🇹🇭", currencyCode: "THB", currencySymbol: "฿", exchangeToUsd: 0.028, mapX: 74, mapY: 52, capital: "Bangkok",
    states: ["Bangkok","Chiang Mai","Chonburi","Nakhon Ratchasima","Khon Kaen","Songkhla","Udon Thani","Pathum Thani","Samut Prakan","Nonthaburi","Rayong","Phuket","Surat Thani","Chiang Rai","Nakhon Pathom","Ayutthaya"] },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", currencyCode: "VND", currencySymbol: "₫", exchangeToUsd: 0.000039, mapX: 76, mapY: 50, capital: "Hanoi",
    states: ["Hanoi","Ho Chi Minh","Da Nang","Hai Phong","Can Tho","An Giang","Dong Nai","Binh Duong","Khanh Hoa","Lam Dong","Nghe An","Thanh Hoa","Quang Ninh","Hue","Ba Ria-Vung Tau","Dong Thap"] },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", currencyCode: "MYR", currencySymbol: "RM", exchangeToUsd: 0.21, mapX: 74, mapY: 56, capital: "Kuala Lumpur",
    states: ["Selangor","Johor","Sabah","Sarawak","Perak","Penang","Kedah","Kelantan","Pahang","Terengganu","Negeri Sembilan","Melaka","Perlis","Kuala Lumpur","Putrajaya","Labuan"] },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currencyCode: "ARS", currencySymbol: "$", exchangeToUsd: 0.001, mapX: 30, mapY: 78, capital: "Buenos Aires",
    states: ["Buenos Aires","Córdoba","Santa Fe","Mendoza","Tucumán","Entre Ríos","Salta","Misiones","Chaco","Corrientes","Santiago del Estero","San Juan","Jujuy","Río Negro","Neuquén","Formosa"] },
  { code: "CL", name: "Chile", flag: "🇨🇱", currencyCode: "CLP", currencySymbol: "$", exchangeToUsd: 0.001, mapX: 28, mapY: 80, capital: "Santiago",
    states: ["Santiago Metro","Valparaíso","Biobío","Maule","La Araucanía","O'Higgins","Los Lagos","Coquimbo","Antofagasta","Tarapacá","Atacama","Los Ríos","Ñuble","Aysén","Magallanes","Arica"] },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currencyCode: "COP", currencySymbol: "$", exchangeToUsd: 0.00024, mapX: 26, mapY: 58, capital: "Bogotá",
    states: ["Bogotá","Antioquia","Valle del Cauca","Cundinamarca","Atlántico","Santander","Bolívar","Nariño","Córdoba","Tolima","Boyacá","Magdalena","Huila","Cesar","Norte de Santander","Meta"] },
  { code: "PE", name: "Peru", flag: "🇵🇪", currencyCode: "PEN", currencySymbol: "S/", exchangeToUsd: 0.27, mapX: 26, mapY: 66, capital: "Lima",
    states: ["Lima","Arequipa","La Libertad","Piura","Cusco","Lambayeque","Junín","Cajamarca","Puno","Áncash","Loreto","Ica","San Martín","Tacna","Ucayali","Huánuco"] },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", currencyCode: "NZD", currencySymbol: "NZ$", exchangeToUsd: 0.60, mapX: 92, mapY: 82, capital: "Wellington",
    states: ["Auckland","Wellington","Canterbury","Waikato","Bay of Plenty","Otago","Manawatu","Hawke's Bay","Northland","Taranaki","Southland","Nelson","Marlborough","Gisborne","West Coast","Tasman"] },
  { code: "IE", name: "Ireland", flag: "🇮🇪", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 45, mapY: 30, capital: "Dublin",
    states: ["Dublin","Cork","Galway","Limerick","Waterford","Kerry","Mayo","Donegal","Tipperary","Clare","Wexford","Kilkenny","Meath","Louth","Kildare","Wicklow"] },
  { code: "PT", name: "Portugal", flag: "🇵🇹", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 44, mapY: 40, capital: "Lisbon",
    states: ["Lisbon","Porto","Braga","Setúbal","Aveiro","Faro","Coimbra","Leiria","Santarém","Viseu","Madeira","Azores","Viana do Castelo","Vila Real","Guarda","Évora"] },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", currencyCode: "CHF", currencySymbol: "CHF", exchangeToUsd: 1.12, mapX: 51, mapY: 34, capital: "Bern",
    states: ["Zurich","Bern","Vaud","Aargau","St. Gallen","Geneva","Lucerne","Ticino","Valais","Basel-Stadt","Basel-Landschaft","Fribourg","Thurgau","Solothurn","Graubünden","Neuchâtel"] },
  { code: "AT", name: "Austria", flag: "🇦🇹", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 53, mapY: 34, capital: "Vienna",
    states: ["Vienna","Lower Austria","Upper Austria","Styria","Tyrol","Carinthia","Salzburg","Vorarlberg","Burgenland","Vienna City","Linz","Graz","Innsbruck","Salzburg City","Klagenfurt","Bregenz"] },
  { code: "BE", name: "Belgium", flag: "🇧🇪", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 49, mapY: 32, capital: "Brussels",
    states: ["Brussels","Antwerp","East Flanders","West Flanders","Flemish Brabant","Hainaut","Liège","Limburg","Namur","Luxembourg","Walloon Brabant","Ghent","Bruges","Charleroi","Mons","Leuven"] },
  { code: "DK", name: "Denmark", flag: "🇩🇰", currencyCode: "DKK", currencySymbol: "kr", exchangeToUsd: 0.145, mapX: 51, mapY: 26, capital: "Copenhagen",
    states: ["Capital Region","Central Denmark","North Denmark","Zealand","Southern Denmark","Copenhagen City","Aarhus","Odense","Aalborg","Esbjerg","Randers","Kolding","Horsens","Vejle","Roskilde","Helsingør"] },
  { code: "FI", name: "Finland", flag: "🇫🇮", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 56, mapY: 20, capital: "Helsinki",
    states: ["Uusimaa","Pirkanmaa","Varsinais-Suomi","North Ostrobothnia","Central Finland","Ostrobothnia","Lapland","Satakunta","Päijät-Häme","Kymenlaakso","South Ostrobothnia","North Savo","South Savo","Kainuu","North Karelia","Kanta-Häme"] },
  { code: "GR", name: "Greece", flag: "🇬🇷", currencyCode: "EUR", currencySymbol: "€", exchangeToUsd: 1.08, mapX: 55, mapY: 40, capital: "Athens",
    states: ["Attica","Central Macedonia","Crete","Thessaly","Western Greece","Peloponnese","Eastern Macedonia","Epirus","South Aegean","Central Greece","Ionian Islands","North Aegean","Western Macedonia","Athens Metro","Thessaloniki","Patras"] },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", currencyCode: "CZK", currencySymbol: "Kč", exchangeToUsd: 0.043, mapX: 53, mapY: 32, capital: "Prague",
    states: ["Prague","Central Bohemia","South Moravia","Moravian-Silesia","Ústí","Olomouc","South Bohemia","Zlín","Pilsen","Hradec Králové","Pardubice","Liberec","Vysočina","Karlovy Vary","Brno","Ostrava"] },
  { code: "RO", name: "Romania", flag: "🇷🇴", currencyCode: "RON", currencySymbol: "lei", exchangeToUsd: 0.22, mapX: 56, mapY: 34, capital: "Bucharest",
    states: ["Bucharest","Cluj","Timiș","Iași","Constanța","Brașov","Prahova","Dolj","Suceava","Argeș","Bihor","Mureș","Galați","Sibiu","Bacău","Maramureș"] },
  { code: "HU", name: "Hungary", flag: "🇭🇺", currencyCode: "HUF", currencySymbol: "Ft", exchangeToUsd: 0.0027, mapX: 54, mapY: 34, capital: "Budapest",
    states: ["Budapest","Pest","Borsod","Szabolcs","Hajdú-Bihar","Győr-Moson","Bács-Kiskun","Csongrád","Fejér","Veszprém","Somogy","Baranya","Tolna","Heves","Nógrád","Vas"] },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", currencyCode: "UAH", currencySymbol: "₴", exchangeToUsd: 0.024, mapX: 58, mapY: 32, capital: "Kyiv",
    states: ["Kyiv","Kharkiv","Odesa","Dnipropetrovsk","Lviv","Donetsk","Zaporizhzhia","Luhansk","Vinnytsia","Poltava","Mykolaiv","Ivano-Frankivsk","Chernihiv","Sumy","Zhytomyr","Khmelnytskyi"] },
  { code: "IL", name: "Israel", flag: "🇮🇱", currencyCode: "ILS", currencySymbol: "₪", exchangeToUsd: 0.27, mapX: 58, mapY: 42, capital: "Jerusalem",
    states: ["Jerusalem","Tel Aviv","Haifa","Central","Northern","Southern","Judea and Samaria","Ashdod","Rishon LeZion","Petah Tikva","Beersheba","Netanya","Holon","Bnei Brak","Ramat Gan","Rehovot"] },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", currencyCode: "PKR", currencySymbol: "Rs", exchangeToUsd: 0.0036, mapX: 66, mapY: 46, capital: "Islamabad",
    states: ["Punjab","Sindh","Khyber Pakhtunkhwa","Balochistan","Islamabad","Gilgit-Baltistan","Azad Kashmir","Karachi","Lahore","Faisalabad","Rawalpindi","Multan","Peshawar","Quetta","Hyderabad","Gujranwala"] },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", currencyCode: "BDT", currencySymbol: "৳", exchangeToUsd: 0.0082, mapX: 72, mapY: 48, capital: "Dhaka",
    states: ["Dhaka","Chittagong","Rajshahi","Khulna","Sylhet","Barisal","Rangpur","Mymensingh","Gazipur","Narayanganj","Comilla","Bogura","Jessore","Dinajpur","Cox's Bazar","Tangail"] },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", currencyCode: "ETB", currencySymbol: "Br", exchangeToUsd: 0.017, mapX: 60, mapY: 56, capital: "Addis Ababa",
    states: ["Addis Ababa","Oromia","Amhara","Tigray","Somali","SNNPR","Afar","Benishangul","Gambela","Dire Dawa","Harari","Sidama","South West","Central Ethiopia","Hawassa","Mekelle"] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currencyCode: "TZS", currencySymbol: "TSh", exchangeToUsd: 0.00038, mapX: 58, mapY: 64, capital: "Dodoma",
    states: ["Dar es Salaam","Dodoma","Arusha","Mwanza","Mbeya","Morogoro","Tanga","Kilimanjaro","Kagera","Pwani","Shinyanga","Tabora","Iringa","Mara","Zanzibar Urban","Zanzibar North"] },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currencyCode: "UGX", currencySymbol: "USh", exchangeToUsd: 0.00027, mapX: 56, mapY: 58, capital: "Kampala",
    states: ["Kampala","Wakiso","Mukono","Jinja","Mbale","Gulu","Mbarara","Fort Portal","Arua","Lira","Masaka","Entebbe","Hoima","Soroti","Kabale","Tororo"] },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", currencyCode: "RWF", currencySymbol: "FRw", exchangeToUsd: 0.00077, mapX: 56, mapY: 60, capital: "Kigali",
    states: ["Kigali","Northern","Southern","Eastern","Western","Gasabo","Kicukiro","Nyarugenge","Musanze","Huye","Rubavu","Nyagatare","Muhanga","Rwamagana","Rusizi","Bugesera"] },
  { code: "SN", name: "Senegal", flag: "🇸🇳", currencyCode: "XOF", currencySymbol: "CFA", exchangeToUsd: 0.0016, mapX: 42, mapY: 50, capital: "Dakar",
    states: ["Dakar","Thiès","Diourbel","Saint-Louis","Kaolack","Ziguinchor","Louga","Fatick","Kolda","Tambacounda","Matam","Kaffrine","Kédougou","Sédhiou","Rufisque","Mbour"] },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", currencyCode: "XOF", currencySymbol: "CFA", exchangeToUsd: 0.0016, mapX: 46, mapY: 54, capital: "Yamoussoukro",
    states: ["Abidjan","Yamoussoukro","Bouaké","San-Pédro","Korhogo","Daloa","Man","Gagnoa","Abengourou","Divo","Anyama","Soubré","Odienné","Bondoukou","Séguéla","Ferkessédougou"] },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", currencyCode: "XAF", currencySymbol: "FCFA", exchangeToUsd: 0.0016, mapX: 52, mapY: 56, capital: "Yaoundé",
    states: ["Centre","Littoral","West","Northwest","Southwest","North","Far North","Adamawa","East","South","Yaoundé","Douala","Bamenda","Bafoussam","Garoua","Maroua"] },
  { code: "MA", name: "Morocco", flag: "🇲🇦", currencyCode: "MAD", currencySymbol: "د.م.", exchangeToUsd: 0.10, mapX: 46, mapY: 42, capital: "Rabat",
    states: ["Casablanca-Settat","Rabat-Salé","Marrakech-Safi","Fès-Meknès","Tanger-Tétouan","Souss-Massa","Oriental","Béni Mellal","Drâa-Tafilalet","Guelmim","Laâyoune","Dakhla","Casablanca","Marrakech","Fès","Agadir"] },
  { code: "DZ", name: "Algeria", flag: "🇩🇿", currencyCode: "DZD", currencySymbol: "د.ج", exchangeToUsd: 0.0074, mapX: 50, mapY: 42, capital: "Algiers",
    states: ["Algiers","Oran","Constantine","Annaba","Blida","Batna","Sétif","Djelfa","Sidi Bel Abbès","Biskra","Tébessa","Tlemcen","Béjaïa","Tizi Ouzou","Ouargla","Béchar"] },
  { code: "TN", name: "Tunisia", flag: "🇹🇳", currencyCode: "TND", currencySymbol: "د.ت", exchangeToUsd: 0.32, mapX: 52, mapY: 40, capital: "Tunis",
    states: ["Tunis","Sfax","Sousse","Kairouan","Bizerte","Gabès","Ariana","Gafsa","Monastir","Ben Arous","Kasserine","Médenine","Nabeul","Sidi Bouzid","Jendouba","Mahdia"] },
  { code: "AO", name: "Angola", flag: "🇦🇴", currencyCode: "AOA", currencySymbol: "Kz", exchangeToUsd: 0.0011, mapX: 52, mapY: 70, capital: "Luanda",
    states: ["Luanda","Benguela","Huambo","Huíla","Cabinda","Cuanza Sul","Bié","Moxico","Uíge","Zaire","Malanje","Lunda Norte","Lunda Sul","Namibe","Cunene","Cuando Cubango"] },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿", currencyCode: "MZN", currencySymbol: "MT", exchangeToUsd: 0.015, mapX: 58, mapY: 72, capital: "Maputo",
    states: ["Maputo","Sofala","Nampula","Zambezia","Tete","Manica","Inhambane","Gaza","Cabo Delgado","Niassa","Maputo City","Beira","Nacala","Quelimane","Chimoio","Pemba"] },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", currencyCode: "ZWL", currencySymbol: "Z$", exchangeToUsd: 0.003, mapX: 56, mapY: 74, capital: "Harare",
    states: ["Harare","Bulawayo","Manicaland","Mashonaland East","Mashonaland West","Mashonaland Central","Masvingo","Midlands","Matabeleland North","Matabeleland South","Chitungwiza","Mutare","Gweru","Kwekwe","Kadoma","Victoria Falls"] },
  { code: "ZM", name: "Zambia", flag: "🇿🇲", currencyCode: "ZMW", currencySymbol: "ZK", exchangeToUsd: 0.038, mapX: 56, mapY: 68, capital: "Lusaka",
    states: ["Lusaka","Copperbelt","Southern","Eastern","Northern","Central","North-Western","Western","Luapula","Muchinga","Ndola","Kitwe","Livingstone","Chipata","Kabwe","Solwezi"] },
  { code: "BW", name: "Botswana", flag: "🇧🇼", currencyCode: "BWP", currencySymbol: "P", exchangeToUsd: 0.074, mapX: 54, mapY: 76, capital: "Gaborone",
    states: ["South-East","Central","Kgatleng","Kweneng","Southern","North-East","North-West","Ghanzi","Kgalagadi","Chobe","Gaborone","Francistown","Maun","Molepolole","Serowe","Selebi-Phikwe"] },
  { code: "NA", name: "Namibia", flag: "🇳🇦", currencyCode: "NAD", currencySymbol: "N$", exchangeToUsd: 0.055, mapX: 52, mapY: 76, capital: "Windhoek",
    states: ["Khomas","Erongo","Oshana","Oshikoto","Ohangwena","Kavango East","Zambezi","Otjozondjupa","Hardap","Karas","Kunene","Omaheke","Omusati","Kavango West","Windhoek","Walvis Bay"] },
  { code: "QA", name: "Qatar", flag: "🇶🇦", currencyCode: "QAR", currencySymbol: "ر.ق", exchangeToUsd: 0.27, mapX: 62, mapY: 46, capital: "Doha",
    states: ["Doha","Al Rayyan","Al Wakrah","Umm Salal","Al Khor","Al Daayen","Al Shamal","Al Shahaniya","West Bay","The Pearl","Lusail","Education City","Hamad Airport","Mesaieed","Dukhan","Al Wukair"] },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", currencyCode: "KWD", currencySymbol: "د.ك", exchangeToUsd: 3.25, mapX: 60, mapY: 44, capital: "Kuwait City",
    states: ["Capital","Hawalli","Farwaniya","Ahmadi","Jahra","Mubarak Al-Kabeer","Kuwait City","Salmiya","Fahaheel","Mahboula","Jabriya","Rumaithiya","Sabah Al-Salem","Mangaf","Fintas","Abdullah Al-Salem"] },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", currencyCode: "BHD", currencySymbol: ".د.ب", exchangeToUsd: 2.65, mapX: 61, mapY: 45, capital: "Manama",
    states: ["Capital","Muharraq","Northern","Southern","Manama","Riffa","Muharraq City","Hamad Town","Isa Town","Sitra","Budaiya","Jidhafs","A'ali","Tubli","Saar","Amwaj"] },
];

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function plotsForCity(cityKey: string) {
  let h = 0;
  for (let i = 0; i < cityKey.length; i++) h = (h * 31 + cityKey.charCodeAt(i)) >>> 0;
  const bases = [
    [-10, -30], [10, -32], [34, 6], [36, 20], [-6, 34], [10, 36],
    [-40, 10], [-34, -14], [14, -16], [-16, 24], [0, -40], [42, -10],
  ];
  return bases.map((b, i) => ({
    name: `Plot ${i + 1}`,
    posX: b[0],
    posZ: b[1],
    price: 6000 + ((h + i * 997) % 9000),
  }));
}

async function main() {
  console.log(`Seeding world: ${COUNTRIES.length} countries…`);
  let stateCount = 0;
  let cityCount = 0;

  for (const c of COUNTRIES) {
    const country = await prisma.country.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        flag: c.flag,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol,
        exchangeToUsd: c.exchangeToUsd,
        mapX: c.mapX,
        mapY: c.mapY,
      },
      create: {
        code: c.code,
        name: c.name,
        flag: c.flag,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol,
        exchangeToUsd: c.exchangeToUsd,
        mapX: c.mapX,
        mapY: c.mapY,
      },
    });

    const states = c.states.slice(0, Math.max(15, c.states.length));
    for (let si = 0; si < states.length; si++) {
      const stateName = states[si];
      const stateCode = slug(stateName).slice(0, 12).toUpperCase() || `S${si}`;
      const mapX = 15 + (si % 5) * 18 + (si % 3) * 2;
      const mapY = 15 + Math.floor(si / 5) * 22;

      const state = await prisma.state.upsert({
        where: { countryId_code: { countryId: country.id, code: stateCode } },
        update: { name: stateName, mapX, mapY },
        create: {
          countryId: country.id,
          code: stateCode,
          name: stateName,
          mapX,
          mapY,
        },
      });
      stateCount++;

      // 2 cities per state: capital-style + secondary
      const cityNames =
        si === 0
          ? [c.capital, `${stateName} City`]
          : [`${stateName} Central`, `${stateName} Town`];

      for (let ci = 0; ci < cityNames.length; ci++) {
        const cityName = cityNames[ci];
        let key = slug(`${c.code}_${stateCode}_${cityName}`);
        if (c.code === "NG" && stateName === "Lagos" && ci === 0) key = "lagos";
        if (c.code === "NG" && stateName === "Abuja FCT" && ci === 0) key = "abuja";
        if (c.code === "US" && stateName === "New York" && ci === 0) key = "newyork";
        if (c.code === "GB" && stateName === "Greater London" && ci === 0) key = "london";
        if (c.code === "JP" && stateName === "Tokyo" && ci === 0) key = "tokyo";

        // ensure unique key if collision
        const existing = await prisma.city.findUnique({ where: { key } });
        if (existing && existing.countryId !== country.id) {
          key = `${key}_${c.code.toLowerCase()}`;
        }

        await prisma.city.upsert({
          where: { key },
          update: {
            name: cityName,
            mapX: mapX + ci * 8,
            mapY: mapY + ci * 6,
            stateId: state.id,
            countryId: country.id,
          },
          create: {
            key,
            name: cityName,
            mapX: mapX + ci * 8,
            mapY: mapY + ci * 6,
            countryId: country.id,
            stateId: state.id,
            districtKey: "downtown",
          },
        });
        cityCount++;
      }
    }
  }

  // Plots for a sample of cities (not all — keep seed fast). Prefer major keys + first city per country.
  const plotCities = await prisma.city.findMany({
    where: {
      OR: [
        { key: { in: ["lagos", "abuja", "newyork", "london", "tokyo", "dubai", "paris"] } },
        { name: { contains: "Central" } },
      ],
    },
    take: 80,
  });
  for (const city of plotCities) {
    const count = await prisma.buildPlot.count({ where: { cityId: city.id } });
    if (count > 0) continue;
    for (const p of plotsForCity(city.key)) {
      await prisma.buildPlot.create({
        data: {
          cityId: city.id,
          name: `${city.name} ${p.name}`,
          posX: p.posX,
          posZ: p.posZ,
          size: 10,
          price: p.price,
        },
      });
    }
  }

  await seedTravel(prisma);

  console.log(`Done: ${COUNTRIES.length} countries, ${stateCount} states, ~${cityCount} cities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
