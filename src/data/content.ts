import type {
  BlogPost,
  Language,
  LoyaltyTier,
  MenuCategory,
  MenuItem,
  MenuItemVariant,
  SocialLink,
  StoreLocation,
} from "@/types";
import { SnappFoodIcon } from "@/components/SnappFoodIcon"; 
import { InstagramIcon } from "@/components/InstagramIcon";



const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop`;

/**
 * سازنده واریانت کاتالوگ ثابت.
 *
 * واریانت‌های کاتالوگ شناسه دیتابیس (`id`) ندارند؛ چون خودِ آیتم هم `productId`
 * ندارد و سفارش آنلاین برایش ممکن نیست. به‌محض اتصال پنل، همان واریانت‌ها با
 * شناسه واقعی از `/api/public/menu` می‌آیند.
 */
const variant = (key: string, en: string, fa: string, price: number): MenuItemVariant => ({
  key,
  label: { en, fa },
  price,
});

/**
 * سه سایز استاندارد پیتزا: تک نفره، دو نفره و شش نفره.
 * قیمت هر سایز مستقل است و کاربر همان را در صفحه محصول انتخاب می‌کند.
 */
const pizzaSizes = (single: number, double: number, six: number): MenuItemVariant[] => [
  variant("single", "Single serving (1 person)", "تک نفره", single),
  variant("double", "Double serving (2 people)", "دو نفره", double),
  variant("six", "Party size (6 people)", "شش نفره", six),
];

export const heroImage = pexels(32862018);
export const aboutImage = pexels(35420742);
export const locationImage = pexels(33880394);

export const menuItems: MenuItem[] = [
  // {
  //   id: "smoky-smash",
  //   category: "burgers",
  //   name: { en: "Smoky Smash", fa: "اسموکی اسمش" },
  //   description: {
  //     en: "Two crisp-edged patties, smoked cheddar and house sauce.",
  //     fa: "دو پتی لبه‌برشته، چدار دودی و سس مخصوص خانه.",
  //   },
  //   fullDescription: {
  //     en: "Our signature double smash starts on a ripping-hot griddle, then meets smoked cheddar, caramelized onion, crisp pickles and our peppery house sauce in a toasted brioche bun.",
  //     fa: "برگر ویژه ما با دو پتی اسمش روی گریل داغ، پنیر چدار دودی، پیاز کاراملی، خیارشور ترد و سس فلفلی مخصوص در نان بریوش برشته آماده می‌شود.",
  //   },
  //   image: pexels(5041475),
  //   imageAlt: { en: "Smoky cheeseburger on a plate", fa: "چیزبرگر دودی در بشقاب" },
  //   price: 485000,
  //   rating: 4.9,
  //   score: 9.6,
  //   featured: true,
  //   ingredients: {
  //     en: ["Double beef", "Smoked cheddar", "Caramelized onion", "Pickles", "House sauce"],
  //     fa: ["دو پتی گوشت", "چدار دودی", "پیاز کاراملی", "خیارشور", "سس مخصوص"],
  //   },
  //   options: {
  //     en: ["Single or double", "Jalapeno", "Gluten-free bun", "Extra cheddar"],
  //     fa: ["تک یا دوبل", "هالوپینو", "نان بدون گلوتن", "چدار اضافه"],
  //   },
  // },
  // {
  //   id: "firehouse-double",
  //   category: "burgers",
  //   name: { en: "Firehouse Double", fa: "فایرهاوس دوبل" },
  //   description: {
  //     en: "Double beef, ember sauce, jalapeno and molten cheese.",
  //     fa: "گوشت دوبل، سس آتشین، هالوپینو و پنیر آب‌شده.",
  //   },
  //   fullDescription: {
  //     en: "A proper late-night burger with double beef, American cheese, charred jalapenos and our slow-building ember sauce. Rich, hot and balanced with crunchy slaw.",
  //     fa: "یک برگر واقعی برای آخر شب با گوشت دوبل، پنیر آمریکایی، هالوپینوی گریل‌شده و سس آتشین؛ تند، غنی و متعادل با سالاد کلم ترد.",
  //   },
  //   image: pexels(20003238),
  //   imageAlt: { en: "Hand holding a juicy double burger", fa: "برگر دوبل آبدار در دست" },
  //   price: 525000,
  //   rating: 4.8,
  //   score: 9.3,
  //   featured: true,
  //   ingredients: {
  //     en: ["Double beef", "American cheese", "Jalapeno", "Slaw", "Ember sauce"],
  //     fa: ["گوشت دوبل", "پنیر آمریکایی", "هالوپینو", "سالاد کلم", "سس آتشین"],
  //   },
  //   options: {
  //     en: ["Heat level", "Extra patty", "No onion", "Lettuce wrap"],
  //     fa: ["درجه تندی", "پتی اضافه", "بدون پیاز", "رپ کاهو"],
  //   },
  // },
  // {
  //   id: "crispy-saffron",
  //   category: "burgers",
  //   name: { en: "Crispy Saffron", fa: "کریسپی زعفرانی" },
  //   description: {
  //     en: "Buttermilk chicken, saffron aioli and crunchy pickles.",
  //     fa: "مرغ باترمیلک، آیولی زعفرانی و خیارشور ترد.",
  //   },
  //   fullDescription: {
  //     en: "Juicy chicken marinated overnight, fried until shatter-crisp and finished with saffron aioli, pickled cabbage and herbs on a soft potato bun.",
  //     fa: "مرغ آبدار با مرینیت شبانه که کاملا ترد سرخ شده و با آیولی زعفرانی، کلم ترش و سبزی تازه در نان سیب‌زمینی سرو می‌شود.",
  //   },
  //   image: pexels(10361459),
  //   imageAlt: { en: "Crispy chicken sandwich with sauce", fa: "ساندویچ مرغ کریسپی با سس" },
  //   price: 445000,
  //   rating: 4.8,
  //   score: 9.2,
  //   featured: true,
  //   ingredients: {
  //     en: ["Buttermilk chicken", "Saffron aioli", "Pickled cabbage", "Herbs", "Potato bun"],
  //     fa: ["مرغ باترمیلک", "آیولی زعفرانی", "کلم ترش", "سبزی تازه", "نان سیب‌زمینی"],
  //   },
  //   options: {
  //     en: ["Classic or spicy", "Extra aioli", "No cabbage", "Add cheddar"],
  //     fa: ["کلاسیک یا تند", "آیولی اضافه", "بدون کلم", "چدار اضافه"],
  //   },
  // },
  // {
  //   id: "garden-char",
  //   category: "burgers",
  //   name: { en: "Garden Char", fa: "گاردن چار" },
  //   description: {
  //     en: "Charred vegetable patty, herbs and bright tahini sauce.",
  //     fa: "پتی سبزیجات گریل‌شده، سبزی تازه و سس ارده.",
  //   },
  //   fullDescription: {
  //     en: "A deeply savory vegetable patty with charred mushrooms and lentils, layered with lettuce, tomato, herbs and bright lemon tahini.",
  //     fa: "پتی خوش‌طعم سبزیجات با قارچ گریل‌شده و عدس، همراه کاهو، گوجه، سبزی تازه و ارده لیمویی.",
  //   },
  //   image: pexels(23106708),
  //   imageAlt: { en: "Vegetable burger with fresh salad", fa: "برگر سبزیجات با سالاد تازه" },
  //   price: 395000,
  //   rating: 4.6,
  //   score: 8.9,
  //   featured: false,
  //   ingredients: {
  //     en: ["Mushroom-lentil patty", "Lettuce", "Tomato", "Herbs", "Lemon tahini"],
  //     fa: ["پتی قارچ و عدس", "کاهو", "گوجه", "سبزی تازه", "ارده لیمویی"],
  //   },
  //   options: {
  //     en: ["Vegan bun", "Extra patty", "Add cheese", "No tomato"],
  //     fa: ["نان وگان", "پتی اضافه", "پنیر اضافه", "بدون گوجه"],
  //   },
  // },
  // {
  //   id: "pizza-margherita",
  //   category: "pizza",
  //   name: { en: "Margherita", fa: "مارگاریتا" },
  //   description: {
  //     en: "San Marzano tomato, fior di latte and basil on a blistered crust.",
  //     fa: "گوجه سان‌مارزانو، پنیر فیوردیلاته و ریحان تازه روی خمیر حباب‌دار.",
  //   },
  //   fullDescription: {
  //     en: "A slow-proofed dough stretched by hand, topped with crushed San Marzano tomato, fior di latte mozzarella, fresh basil and a thread of olive oil. Choose the size that fits the table.",
  //     fa: "خمیر با تخمیر آرام که با دست باز می‌شود؛ روی آن گوجه سان‌مارزانو، موزارلای فیوردیلاته، ریحان تازه و کمی روغن زیتون. سایزی را انتخاب کنید که به میز شما می‌خورد.",
  //   },
  //   image: pexels(825661),
  //   imageAlt: { en: "Margherita pizza with fresh basil", fa: "پیتزا مارگاریتا با ریحان تازه" },
  //   price: 235000,
  //   rating: 4.7,
  //   score: 9,
  //   featured: false,
  //   variants: pizzaSizes(235000, 425000, 980000),
  //   ingredients: {
  //     en: ["Slow-proofed dough", "San Marzano tomato", "Fior di latte", "Basil", "Olive oil"],
  //     fa: ["خمیر تخمیر‌آرام", "گوجه سان‌مارزانو", "پنیر فیوردیلاته", "ریحان تازه", "روغن زیتون"],
  //   },
  //   options: {
  //     en: ["Extra cheese", "Chili flakes", "Add mushroom", "Thin or thick crust"],
  //     fa: ["پنیر اضافه", "فلفل قرمز", "قارچ اضافه", "خمیر نازک یا ضخیم"],
  //   },
  // },
  // {
  //   id: "pizza-pepperoni",
  //   category: "pizza",
  //   name: { en: "Pepperoni Heat", fa: "پپرونی تند" },
  //   description: {
  //     en: "Beef pepperoni, mozzarella and a slow chili-honey drizzle.",
  //     fa: "پپرونی گوشت، موزارلا و عسل فلفلی.",
  //   },
  //   fullDescription: {
  //     en: "Cups of beef pepperoni that crisp at the edges, mozzarella and tomato sauce, finished with a chili-honey drizzle in the last minute of the bake.",
  //     fa: "ورقه‌های پپرونی گوشت که لبه‌هایشان ترد می‌شود، موزارلا و سس گوجه؛ در دقیقه آخر پخت با عسل فلفلی تمام می‌شود.",
  //   },
  //   image: pexels(315755),
  //   imageAlt: { en: "Pepperoni pizza with melted cheese", fa: "پیتزا پپرونی با پنیر آب‌شده" },
  //   price: 285000,
  //   rating: 4.8,
  //   score: 9.3,
  //   featured: false,
  //   variants: pizzaSizes(285000, 495000, 1150000),
  //   ingredients: {
  //     en: ["Beef pepperoni", "Mozzarella", "Tomato sauce", "Chili honey", "Oregano"],
  //     fa: ["پپرونی گوشت", "موزارلا", "سس گوجه", "عسل فلفلی", "آویشن"],
  //   },
  //   options: {
  //     en: ["Extra pepperoni", "Hot honey", "No oregano", "Stuffed crust"],
  //     fa: ["پپرونی اضافه", "عسل تند", "بدون آویشن", "خمیر پنیری"],
  //   },
  // },
  // {
  //   id: "pizza-elin-special",
  //   category: "pizza",
  //   name: { en: "Elin House", fa: "مخصوص الین" },
  //   description: {
  //     en: "Seasoned beef, garlic mushroom, roasted pepper and smoked cheddar.",
  //     fa: "گوشت ادویه‌دار، قارچ سیر، فلفل گریل و چدار دودی.",
  //   },
  //   fullDescription: {
  //     en: "Our house pizza: seasoned beef, garlic mushrooms, roasted bell pepper, smoked cheddar and a scatter of black olive. Loaded, but balanced enough for another slice.",
  //     fa: "پیتزای مخصوص ما: گوشت ادویه‌دار، قارچ سیر، فلفل دلمه‌ای گریل، چدار دودی و کمی زیتون سیاه؛ پرمایه اما متعادل برای برش بعدی.",
  //   },
  //   image: pexels(2147491),
  //   imageAlt: { en: "Loaded house pizza with beef and vegetables", fa: "پیتزای مخصوص با گوشت و سبزیجات" },
  //   price: 315000,
  //   rating: 4.9,
  //   score: 9.4,
  //   featured: false,
  //   variants: pizzaSizes(315000, 545000, 1280000),
  //   ingredients: {
  //     en: ["Seasoned beef", "Garlic mushroom", "Roasted pepper", "Smoked cheddar", "Black olive"],
  //     fa: ["گوشت ادویه‌دار", "قارچ سیر", "فلفل گریل", "چدار دودی", "زیتون سیاه"],
  //   },
  //   options: {
  //     en: ["Extra beef", "Jalapeno", "No olive", "Add a fries side"],
  //     fa: ["گوشت اضافه", "هالوپینو", "بدون زیتون", "سیب‌زمینی کنار"],
  //   },
  // },
  // {
  //   id: "pizza-garden-green",
  //   category: "pizza",
  //   name: { en: "Garden Green", fa: "سبزیجات گاردن" },
  //   description: {
  //     en: "Grilled courgette, mushroom, cherry tomato and basil pesto.",
  //     fa: "کدوی گریل، قارچ، گوجه گیلاسی و پستوی ریحان.",
  //   },
  //   fullDescription: {
  //     en: "A lighter pizza with grilled courgette, mushrooms, cherry tomatoes and red onion over mozzarella, finished with basil pesto.",
  //     fa: "پیتزای سبک‌تر با کدوی گریل، قارچ، گوجه گیلاسی و پیاز قرمز روی موزارلا که با پستوی ریحان تمام می‌شود.",
  //   },
  //   image: pexels(1653877),
  //   imageAlt: { en: "Vegetable pizza with fresh vegetables", fa: "پیتزای سبزیجات با سبزی تازه" },
  //   price: 265000,
  //   rating: 4.6,
  //   score: 8.9,
  //   featured: false,
  //   variants: pizzaSizes(265000, 465000, 1090000),
  //   ingredients: {
  //     en: ["Grilled courgette", "Mushroom", "Cherry tomato", "Red onion", "Basil pesto"],
  //     fa: ["کدوی گریل", "قارچ", "گوجه گیلاسی", "پیاز قرمز", "پستوی ریحان"],
  //   },
  //   options: {
  //     en: ["Vegan cheese", "Extra pesto", "No onion", "Gluten-free base"],
  //     fa: ["پنیر وگان", "پستو اضافه", "بدون پیاز", "خمیر بدون گلوتن"],
  //   },
  // },

  // {
  //   id: "ember-fries",
  //   category: "sides",
  //   name: { en: "Ember Fries", fa: "فرایز امبر" },
  //   description: {
  //     en: "Crisp skin-on fries, ember spice and roasted garlic dip.",
  //     fa: "سیب‌زمینی پوست‌دار ترد، ادویه امبر و دیپ سیر برشته.",
  //   },
  //   fullDescription: {
  //     en: "Twice-fried skin-on potatoes dusted with smoky ember spice and served with a cool roasted garlic dip.",
  //     fa: "سیب‌زمینی پوست‌دار دوبار سرخ‌شده با ادویه دودی امبر و دیپ خنک سیر برشته.",
  //   },
  //   image: pexels(5946428),
  //   imageAlt: { en: "Bowl of crispy seasoned fries", fa: "کاسه سیب‌زمینی ادویه‌دار ترد" },
  //   price: 185000,
  //   rating: 4.7,
  //   score: 9,
  //   featured: false,
  //   ingredients: { en: ["Potato", "Ember spice", "Garlic dip"], fa: ["سیب‌زمینی", "ادویه امبر", "دیپ سیر"] },
  //   options: { en: ["Regular or large", "Cheese sauce", "Extra spice"], fa: ["معمولی یا بزرگ", "سس پنیر", "ادویه اضافه"] },
  // },
  // {
  //   id: "golden-rings",
  //   category: "sides",
  //   name: { en: "Golden Rings", fa: "حلقه‌های طلایی" },
  //   description: {
  //     en: "Beer-battered onion rings with tangy mustard dip.",
  //     fa: "حلقه‌های پیاز سوخاری با دیپ خردل ترش.",
  //   },
  //   fullDescription: {
  //     en: "Sweet onion rings in a feather-light crisp batter with mustard pickle dip on the side.",
  //     fa: "حلقه‌های پیاز شیرین با روکش سبک و ترد، همراه دیپ خردل و خیارشور.",
  //   },
  //   image: pexels(30709506),
  //   imageAlt: { en: "Golden fried snacks with dipping sauce", fa: "اسنک‌های سوخاری طلایی با سس" },
  //   price: 210000,
  //   rating: 4.5,
  //   score: 8.7,
  //   featured: false,
  //   ingredients: { en: ["Sweet onion", "Crisp batter", "Mustard dip"], fa: ["پیاز شیرین", "روکش ترد", "دیپ خردل"] },
  //   options: { en: ["Regular or large", "Extra dip"], fa: ["معمولی یا بزرگ", "دیپ اضافه"] },
  // },
  // {
  //   id: "lime-cola",
  //   category: "drinks",
  //   name: { en: "Fresh Lime Cola", fa: "کولای لیموی تازه" },
  //   description: {
  //     en: "Ice-cold craft cola, fresh lime and crushed mint.",
  //     fa: "کولای دست‌ساز یخی، لیموی تازه و نعناع خردشده.",
  //   },
  //   fullDescription: {
  //     en: "Our house cola poured over clear ice with lime, crushed mint and a pinch of sea salt.",
  //     fa: "کولای مخصوص خانه روی یخ شفاف با لیمو، نعناع خردشده و کمی نمک دریا.",
  //   },
  //   image: pexels(9271561),
  //   imageAlt: { en: "Cold lime and mint drink over ice", fa: "نوشیدنی خنک لیمو و نعناع با یخ" },
  //   price: 125000,
  //   rating: 4.6,
  //   score: 8.8,
  //   featured: false,
  //   ingredients: { en: ["Craft cola", "Fresh lime", "Mint", "Ice"], fa: ["کولای دست‌ساز", "لیموی تازه", "نعناع", "یخ"] },
  //   options: { en: ["Regular or large", "Less ice", "Sugar-free"], fa: ["معمولی یا بزرگ", "یخ کمتر", "بدون شکر"] },
  // },
  // {
  //   id: "night-feast",
  //   category: "combos",
  //   name: { en: "Night Feast", fa: "ضیافت شب" },
  //   description: {
  //     en: "Two signature burgers, loaded fries and two cold drinks.",
  //     fa: "دو برگر ویژه، فرایز مخصوص و دو نوشیدنی خنک.",
  //   },
  //   fullDescription: {
  //     en: "The full شیش برگر الین experience for two: choose two signature burgers, share loaded ember fries and add two house drinks.",
  //     fa: "تجربه کامل شیش برگر الین برای دو نفر: دو برگر ویژه انتخاب کنید، فرایز امبر را شریک شوید و دو نوشیدنی خانه بردارید.",
  //   },
  //   image: pexels(20003199),
  //   imageAlt: { en: "Burger combo with fries and drinks", fa: "پک برگر با سیب‌زمینی و نوشیدنی" },
  //   price: 1050000,
  //   rating: 4.9,
  //   score: 9.5,
  //   featured: false,
  //   ingredients: { en: ["Two burgers", "Loaded fries", "Two drinks"], fa: ["دو برگر", "فرایز مخصوص", "دو نوشیدنی"] },
  //   options: { en: ["Choose burgers", "Choose drinks", "Heat level"], fa: ["انتخاب برگر", "انتخاب نوشیدنی", "درجه تندی"] },
  // },
];

export const blogPosts: BlogPost[] = [
  {
    id: "smash-science",
    title: { en: "The science of the perfect smash", fa: "علم پشت یک  برگر بی‌نقص" },
    excerpt: {
      en: "Heat, pressure and timing: the three details behind those crisp edges.",
      fa: "حرارت، فشار و زمان؛ سه نکته پشت لبه‌های ترد برگر.",
    },
    body: {
      en: [
        "A smash burger looks simple, but the best crust comes from careful control. We start with a hot steel griddle and fresh, loosely packed beef. One confident press creates maximum contact with the heat.",
        "The browning is the Maillard reaction at work. It builds hundreds of savory flavors in under two minutes. We flip only once, add cheese immediately and let the bun capture every bit of flavor.",
        "The result is a lacy, crisp edge and a juicy center. It is fast cooking with no shortcuts, and it is why every burger is smashed to order.",
      ],
      fa: [
        "اسمش برگر ساده به نظر می‌رسد، اما بهترین پوسته با کنترل دقیق به دست می‌آید. ما با صفحه فولادی داغ و گوشت تازه و نرم شروع می‌کنیم. یک فشار محکم، بیشترین تماس با حرارت را ایجاد می‌کند.",
        "قهوه‌ای شدن نتیجه واکنش میلارد است؛ صدها طعم خوشایند در کمتر از دو دقیقه شکل می‌گیرد. برگر فقط یک بار برگردانده می‌شود و پنیر بلافاصله روی آن قرار می‌گیرد.",
        "نتیجه، لبه‌ای توری و ترد با مرکز آبدار است. پختی سریع اما بدون میانبر؛ به همین دلیل هر برگر بعد از سفارش اسمش می‌شود.",
      ],
    },
    date: { en: "May 18, 2026", fa: "۲۸ اردیبهشت ۱۴۰۵" },
    readTime: 4,
    image: pexels(8477417),
    imageAlt: { en: "Close-up of a freshly made burger", fa: "نمای نزدیک برگر تازه" },
  },
  {
    id: "saffron-after-dark",
    title: { en: "after dark", fa: " پس از تاریکی" },
    excerpt: {
      en: "How a familiar Persian aroma found its way into our crispiest sandwich.",
      fa: "چطور یک عطر آشنای ایرانی به تردترین ساندویچ ما رسید.",
    },
    body: {
      en: [
        "Saffron has a floral warmth that works surprisingly well with fried chicken. We bloom the threads slowly, then fold the infusion into a lemony aioli.",
        "The sauce is rich but bright. Pickled cabbage adds snap and acidity, while a soft potato bun keeps the structure balanced.",
        "It is our nod to Tehran flavor without trying to make the burger traditional. Familiar, new and built for another bite.",
      ],
      fa: [
        "زعفران گرمای گلی خاصی دارد که در کنار مرغ سوخاری شگفت‌انگیز عمل می‌کند. رشته‌های زعفران را آرام دم می‌کنیم و سپس با آیولی لیمویی ترکیب می‌کنیم.",
        "سس غنی اما تازه است. کلم ترش، تردی و اسیدیته اضافه می‌کند و نان نرم سیب‌زمینی همه چیز را متعادل نگه می‌دارد.",
        "این ادای احترام ما به طعم بیرجند است، بدون آن‌که برگر را سنتی کنیم؛ آشنا، تازه و وسوسه‌کننده برای گاز بعدی.",
      ],
    },
    date: { en: "May 9, 2026", fa: "۱۹ اردیبهشت ۱۴۰۵" },
    readTime: 3,
    image: pexels(10361459),
    imageAlt: { en: "Crispy chicken sandwich", fa: "ساندویچ مرغ ترد" },
  },
  {
    id: "late-night-table",
    title: { en: "Why food tastes better after 10", fa: "چرا غذا بعد از ساعت ۱۰ خوشمزه‌تر است" },
    excerpt: {
      en: "A love letter to late tables, loud friends and one last shared fry.",
      fa: "نامه‌ای برای میزهای شبانه، دوستان پرانرژی و آخرین سیب‌زمینی مشترک.",
    },
    body: {
      en: [
        "After ten, a restaurant changes. The pace loosens, the music feels closer and a shared table starts to feel like the only place you need to be.",
        "شیش برگر الین was designed for that hour. Warm light, fast service and food that is easy to share but hard to put down.",
        "Stay for the second drink. Split the fries. Order the burger you were thinking about. Night is still young.",
      ],
      fa: [
        "بعد از ساعت ده، رستوران تغییر می‌کند. ریتم آرام‌تر می‌شود، موسیقی نزدیک‌تر به نظر می‌رسد و میز مشترک تنها جایی است که باید باشید.",
        "شیش برگر الین برای همین ساعت طراحی شده؛ نور گرم، سرویس سریع و غذایی که تقسیم کردنش آسان اما کنار گذاشتنش سخت است.",
        "برای نوشیدنی دوم بمانید. سیب‌زمینی را شریک شوید. همان برگری را سفارش دهید که در فکرش بودید. شب هنوز جوان است.",
      ],
    },
    date: { en: "April 27, 2026", fa: "۷ اردیبهشت ۱۴۰۵" },
    readTime: 5,
    image: pexels(31650322),
    imageAlt: { en: "Friends sharing food at a burger restaurant", fa: "دوستان در حال صرف غذا در برگر رستوران" },
  },
  {
    id: "inside-the-kitchen",
    title: { en: "Inside the شیش برگر الین kitchen", fa: "داخل آشپزخانه شیش برگر الین" },
    excerpt: {
      en: "A look at the hands, heat and daily prep behind every order.",
      fa: "نگاهی به دست‌ها، حرارت و آماده‌سازی روزانه پشت هر سفارش.",
    },
    body: {
      en: [
        "Prep begins long before the doors open. Onions cook low and slow, sauces are balanced by taste, and every vegetable is cut for the right bite.",
        "During service, the kitchen becomes a compact rhythm. Grill, toast, dress and pass. Every station has one job and every plate gets a final check.",
        "Speed matters, but consistency matters more. That discipline is what lets a fast burger still feel carefully made.",
      ],
      fa: [
        "آماده‌سازی خیلی قبل از باز شدن درها شروع می‌شود. پیازها آرام می‌پزند، طعم سس‌ها تنظیم می‌شود و هر سبزی برای بهترین بافت برش می‌خورد.",
        "هنگام سرویس، آشپزخانه به یک ریتم فشرده تبدیل می‌شود: گریل، تست، چیدمان و ارسال. هر ایستگاه یک وظیفه دارد و هر بشقاب نهایی بررسی می‌شود.",
        "سرعت مهم است، اما ثبات مهم‌تر. همین نظم باعث می‌شود یک برگر سریع همچنان با دقت آماده‌شده به نظر برسد.",
      ],
    },
    date: { en: "April 12, 2026", fa: "۲۳ فروردین ۱۴۰۵" },
    readTime: 4,
    image: pexels(35420742),
    imageAlt: { en: "Chef preparing burgers in the kitchen", fa: "آشپز در حال آماده کردن برگر" },
  },
];

export const loyaltyTiers: LoyaltyTier[] = [
  {
    id: "bronze",
    name: { en: "First Bite", fa: "لقمه اول" },
    points: { en: "0-499 points", fa: "۰ تا ۴۹۹ امتیاز" },
    description: { en: "Start earning with every bite.", fa: "با هر گاز، امتیاز گرفتن را شروع کنید." },
    multiplier: "1x",
    threshold: 0,
  },
  {
    id: "silver",
    name: { en: "Gourmet", fa: "خوش‌طعم" },
    points: { en: "500-1,499 points", fa: "۵۰۰ تا ۱۴۹۹ امتیاز" },
    description: { en: "Faster rewards and member drops.", fa: "جایزه سریع‌تر و پیشنهادهای ویژه اعضا." },
    multiplier: "1.25x",
    threshold: 500,
  },
  {
    id: "gold",
    name: { en: "Close Friend", fa: "هم‌سفره" },
    points: { en: "1,500+ points", fa: "بیش از ۱۵۰۰ امتیاز" },
    description: { en: "Our best rewards, first access.", fa: "بهترین جایزه‌ها با دسترسی زودتر." },
    multiplier: "1.5x",
    threshold: 1500,
  },
];

/**
 * به ازای هر ۱۰ هزار تومان یک امتیاز باشگاه.
 * همین نرخ در متن صفحه باشگاه و در چک‌اوت به کاربر گفته می‌شود.
 */
export const POINTS_PER_TOMAN = 10_000;

/** امتیازی که یک سفارش با این مبلغ اضافه می‌کند. */
export function pointsForAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount / POINTS_PER_TOMAN);
}

/** سطحی که این امتیاز به آن رسیده است (آخرین آستانه پشت‌سر‌گذاشته‌شده). */
export function tierForPoints(points: number): LoyaltyTier {
  const safe = Number.isFinite(points) ? Math.max(0, points) : 0;
  let current = loyaltyTiers[0];
  for (const tier of loyaltyTiers) {
    if (safe >= tier.threshold) current = tier;
  }
  return current;
}

/** سطح بعدی، یا `null` وقتی عضو در بالاترین سطح است. */
export function nextTierForPoints(points: number): LoyaltyTier | null {
  const current = tierForPoints(points);
  const index = loyaltyTiers.findIndex((tier) => tier.id === current.id);
  return loyaltyTiers[index + 1] ?? null;
}

/**
 * پیشرفت تا سطح بعدی برای نوار `data-progress-bar`.
 * در بالاترین سطح `null` برمی‌گردد چون مقصدی باقی نمانده است.
 */
export function progressToNextTier(points: number): { current: number; target: number; ratio: number } | null {
  const next = nextTierForPoints(points);
  if (!next) return null;
  const current = tierForPoints(points);
  const span = next.threshold - current.threshold;
  const earned = Math.max(0, points - current.threshold);
  return { current: earned, target: span, ratio: span > 0 ? Math.min(1, earned / span) : 1 };
}


export const formatPrice = (price: number, language: Language): string => {
  const formatted = new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-US").format(price);
  return language === "fa" ? `${formatted} تومان` : `${formatted} Toman`;
};

/* ---------------------------------------------------------------------------
 * Derived views.
 * Built once at module scope so components never re-scan the arrays on render
 * (vercel-react-best-practices: "avoid redundant computation in render").
--------------------------------------------------------------------------- */

/** O(1) product lookup for `/menu/:id`. */
export const menuItemById: ReadonlyMap<string, MenuItem> = new Map(
  menuItems.map((item): [string, MenuItem] => [item.id, item]),
);

/** O(1) story lookup for `/blog/:id`. */
export const blogPostById: ReadonlyMap<string, BlogPost> = new Map(
  blogPosts.map((post): [string, BlogPost] => [post.id, post]),
);

export const featuredMenuItems: readonly MenuItem[] = menuItems.filter((item) => item.featured === true);

export const latestBlogPosts: readonly BlogPost[] = blogPosts.slice(0, 3);

/** Buckets built once at module scope, so category switches never re-scan the array. */
const menuItemsByCategoryMap: ReadonlyMap<MenuCategory, readonly MenuItem[]> = (() => {
  const buckets = new Map<MenuCategory, MenuItem[]>();
  for (const item of menuItems) {
    const bucket = buckets.get(item.category);
    if (bucket) bucket.push(item);
    else buckets.set(item.category, [item]);
  }
  return buckets;
})();

export function menuItemsByCategory(category: MenuCategory): readonly MenuItem[] {
  return menuItemsByCategoryMap.get(category) ?? [];
}

/** Same-category picks first, then a short filler so the rail is always full. */
export function relatedMenuItems(
  item: MenuItem,
  limit = 3,
  source: readonly MenuItem[] = menuItems,
): readonly MenuItem[] {
  const sameCategory = source.filter(
    (candidate) => candidate.id !== item.id && candidate.category === item.category,
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
  const filler = source.filter(
    (candidate) => candidate.id !== item.id && candidate.category !== item.category,
  );
  return [...sameCategory, ...filler].slice(0, limit);
}

/* ---------------------------------------------------------------------------
 * واریانت‌ها (اندازه/بسته)
 *
 * یک آیتم می‌تواند چند سایز با قیمت مستقل داشته باشد (مثل پیتزای تک‌نفره،
 * دو نفره و شش‌نفره). این توابع تنها نقطه تصمیم‌گیری درباره واریانت‌ها هستند تا
 * صفحه محصول، کارت منو، سبد خرید و گفتگو یک رفتار داشته باشند.
--------------------------------------------------------------------------- */

/** واریانت‌های قابل انتخاب یک آیتم؛ آیتم بدون واریانت آرایه خالی می‌گیرد. */
export function itemVariants(item: MenuItem): readonly MenuItemVariant[] {
  return item.variants ?? [];
}

/** آیا کاربر باید بین چند سایز/بسته انتخاب کند؟ */
export function hasVariants(item: MenuItem): boolean {
  return itemVariants(item).length > 0;
}

/**
 * واریانت پیش‌فرض: اولین واریانتی که موجود است.
 * اگر همه تمام‌شده باشند `null` برمی‌گردد تا دکمه افزودن غیرفعال شود.
 */
export function defaultVariant(item: MenuItem): MenuItemVariant | null {
  const variants = itemVariants(item);
  if (variants.length === 0) return null;
  return variants.find((candidate) => candidate.available !== false) ?? null;
}

/** واریانت با کلید داده‌شده، یا `null` اگر چنین کلیدی وجود نداشته باشد. */
export function findVariant(item: MenuItem, key: string | null | undefined): MenuItemVariant | null {
  if (!key) return null;
  return itemVariants(item).find((candidate) => candidate.key === key) ?? null;
}

/**
 * بازه قیمت آیتم. برای آیتم بدون واریانت، `min` و `max` هر دو `price` هستند.
 * کارت منو با `min` قیمت «از» را نشان می‌دهد.
 */
export function priceRange(item: MenuItem): { min: number; max: number } {
  const variants = itemVariants(item);
  if (variants.length === 0) return { min: item.price, max: item.price };
  const prices = variants.map((candidate) => candidate.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * قیمتی که باید برای واریانت انتخاب‌شده پرداخت شود.
 * `variantKey` نامعتبر یا خالی باشد، واریانت پیش‌فرض (یا قیمت پایه) برمی‌گردد.
 */
export function priceForVariant(item: MenuItem, variantKey?: string | null): number {
  const chosen = findVariant(item, variantKey) ?? defaultVariant(item);
  return chosen?.price ?? item.price;
}

/* ---------------------------------------------------------------------------
 * Live API merge
 * `/api/public/menu` returns the restaurant's real products; the curated array
 * above stays the source of verified photography, bilingual copy and scores.
 * Merging keeps both without showing the same dish twice.
--------------------------------------------------------------------------- */

/** Folds Persian half-spaces, dashes and whitespace so "اسموکی اسمش" === "اسموکیاسمش". */
function normalizeDishName(value: string): string {
  return value.replace(/[\s\u200c\u200e\u200f\-_.]+/g, "").toLowerCase();
}

/**
 * Curated items win: they ship verified imagery and bilingual copy, so a live
 * product with the same name or slug is dropped instead of duplicated.
 * Everything the dashboard added on top is appended after them.
 */
export function mergeCatalogItems(
  catalog: readonly MenuItem[],
  live: readonly MenuItem[],
): MenuItem[] {
  const seen = new Set<string>();
  const merged: MenuItem[] = [];

  for (const item of catalog) {
    merged.push(item);
    seen.add(item.id);
    seen.add(normalizeDishName(item.name.en));
    seen.add(normalizeDishName(item.name.fa));
  }

  for (const item of live) {
    const name = normalizeDishName(item.name.fa);
    if (seen.has(item.id) || seen.has(name)) continue;
    seen.add(item.id);
    seen.add(name);
    merged.push(item);
  }

  return merged;
}

/* ---------------------------------------------------------------------------
 * بیرون از سایت: شبکه‌های اجتماعی و مکان مغازه.
 *
 * همه مقادیر «پیش‌فرض» هستند و در یک جا جمع شده‌اند تا با اطلاعات واقعی
 * جایگزین شوند؛ هیچ کامپوننتی نشانی هاردکد ندارد.
--------------------------------------------------------------------------- */

/** حساب‌های اینستاگرام. با حساب‌های واقعی جایگزین شود. */
export const instagramAccounts: SocialLink[] = [
  {
    handle: "",
    url: "https://www.instagram.com/6burger.elin",
    label: { en: "6burgerElin on Instagram", fa: "اینستاگرام شیش برگر الین" },
    icon: InstagramIcon,
  },
  {
    handle: "",
    url: "https://snappfood.ir/restaurant/menu/...",
    label: { en: "Shopping with SnappFood", fa: "خرید با اسنپ فود" },
    icon: SnappFoodIcon,
  },
];

/** شماره تماس مغازه (همان شماره‌ای که در فوتر نمایش داده می‌شود). */
export const storePhone = "05632420101";

/**
 * مکان پیش‌فرض مغازه: خیابان ولیعصر، بالاتر از میدابیرجند ، خیابان پاسداران ، نبش تقاطع خیابان15 خرداد، بیرجند.
 *
 * نقشه با `output=embed` ساخته می‌شود که کلید API گوگل نمی‌خواهد و برای نمایش
 * پیش‌فرض کافی است. با نشانی واقعی مغازه جایگزین شود.
 */
export const storeLocation: StoreLocation = {
  lat: 32.84940828577548,
  lng:59.22292664683477,
  embedUrl: "https://www.google.com/maps?q=32.84940828577548, 59.22292664683477&z=16&output=embed",
  directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=32.84940828577548, 59.22292664683477",
  placeUrl: "https://www.google.com/maps/search/?api=1&query=32.84940828577548, 59.22292664683477",
};
