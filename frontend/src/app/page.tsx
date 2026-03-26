import { SearchBar } from "@/components/SearchBar";

const categories = [
  { name: "Smartfonlar", slug: "smartphones", icon: "📱" },
  { name: "Noutbuklar", slug: "laptops", icon: "💻" },
  { name: "Qulaqlıqlar", slug: "headphones", icon: "🎧" },
  { name: "Smartwatch", slug: "smartwatches", icon: "⌚" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Azərbaycanda ən ucuz texnikanı tap
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Kontakt Home, Baku Electronics, Irshad Electronics, iSpace — bütün
          mağazaların qiymətlərini bir axtarışla müqayisə et.
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <SearchBar />
        </div>
      </section>

      {/* Categories */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-gray-900">Kateqoriyalar</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {categories.map((cat) => (
            <a
              key={cat.slug}
              href={`/search?category=${cat.slug}`}
              className="flex flex-col items-center rounded-xl border border-gray-200 p-6 transition hover:border-blue-300 hover:shadow-md"
            >
              <span className="text-4xl">{cat.icon}</span>
              <span className="mt-3 text-sm font-medium text-gray-700">
                {cat.name}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
