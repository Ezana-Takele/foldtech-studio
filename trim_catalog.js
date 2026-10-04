const fs = require('fs');

const p1_p2_p3_clean = `    // Flagship Curated 4-Item Catalog (Verified First 3 Items + Nomad Bundle Only)
    const PRODUCTS = {
      p1: {
        id: 'p1',
        name: 'MagFold™ 3-in-1 Foldable Charger',
        category: 'power',
        badge: 'Flagship Bestseller',
        badgeColor: 'bg-indigo-600',
        price: 34.99,
        originalPrice: 69.99,
        wholesale: 10.50,
        rating: 4.9,
        reviews: 842,
        image: 'magfold_hero.jpg',
        fallback: 'magfold_hero.jpg',
        desc: 'Origami fold charging station for iPhone (15W), Apple Watch, and AirPods simultaneously.'
      },
      p2: {
        id: 'p2',
        name: 'Volt65™ 65W GaN Travel Fast Charger',
        category: 'power',
        badge: 'GaN III Fast',
        badgeColor: 'bg-purple-600',
        price: 24.99,
        originalPrice: 39.99,
        wholesale: 6.20,
        rating: 4.8,
        reviews: 418,
        image: 'volt65_gan.jpg',
        fallback: 'volt65_gan.jpg',
        desc: 'Dual USB-C PD fast power block. Powers MacBook Air, MagFold, and iPad at full wattage.'
      },
      p3: {
        id: 'p3',
        name: 'MagStand™ Slim Leather Wallet & Kickstand',
        category: 'magsafe',
        badge: 'MagSafe Leather',
        badgeColor: 'bg-pink-600',
        price: 19.99,
        originalPrice: 34.99,
        wholesale: 3.40,
        rating: 4.9,
        reviews: 654,
        image: 'magstand_wallet.jpg',
        fallback: 'magstand_wallet.jpg',
        desc: 'Magnetic vegan leather wallet. Snaps to iPhone, holds 3 cards, and folds into portrait/landscape stand.'
      },
      bundle: {
        id: 'bundle',
        name: 'The Ultimate Nomad Travel Bundle (All-in-One)',
        category: 'power',
        badge: '50% OFF BUNDLE',
        badgeColor: 'bg-amber-600',
        price: 59.99,
        originalPrice: 124.97,
        wholesale: 20.10,
        rating: 5.0,
        reviews: 1240,
        image: 'magfold_hero.jpg',
        fallback: 'magfold_hero.jpg',
        desc: 'Complete travel setup: MagFold 3-in-1 Foldable Charger + Volt65 65W GaN Charger + MagStand Leather Wallet in one box.'
      }
    };

    // Treasury Wallets (Ezana Takele)
    const WALLETS`;

let content = fs.readFileSync('c:/Users/lenovo/Desktop/foldtech-studio/index.html', 'utf8');
content = content.replace(/const PRODUCTS = \{[\s\S]*?const WALLETS/, p1_p2_p3_clean);

fs.writeFileSync('c:/Users/lenovo/Desktop/foldtech-studio/index.html', content, 'utf8');
fs.writeFileSync('c:/Users/lenovo/Desktop/assessment/docs/index.html', content, 'utf8');
fs.writeFileSync('c:/Users/lenovo/Desktop/assessment/index.html', content, 'utf8');

console.log('SUCCESSFULLY REPLACED CATALOG');
