export const contentSlugs = [
  "login",
  "about",
  "partnership",
  "social",
  "contact",
  "terms",
  "privacy",
  "personal-data",
  "consent",
] as const;

export type ContentSlug = (typeof contentSlugs)[number];
export type SupportedLocale = "az" | "ru";

export type ContentPage = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: { title: string; body: string }[];
  cta?: { label: string; href: string };
};

export function isContentSlug(value: string): value is ContentSlug {
  return (contentSlugs as readonly string[]).includes(value);
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return value === "az" || value === "ru";
}

export const contentPages: Record<
  SupportedLocale,
  Record<ContentSlug, ContentPage>
> = {
  az: {
    login: {
      eyebrow: "İstifadəçi hesabı",
      title: "Şəxsi kabinet",
      intro:
        "qiymetleri.com platformasından qeydiyyatsız istifadə edə bilərsiniz. Kataloq, axtarış və qiymət müqayisəsi hər kəs üçün tam açıqdır.",
      sections: [
        {
          title: "Mövcud imkanlar",
          body: "Bütün məhsulları axtara, mağaza qiymətlərini müqayisə edə və qiymət dinamikasını izləyə bilərsiniz.",
        },
        {
          title: "Gələcək yeniliklər",
          body: "Yaxın zamanlarda şəxsi kabinet aktivləşdikdə seçilmiş məhsulları yadda saxlamaq və qiymət enişi bildirişləri almaq mümkün olacaq.",
        },
      ],
      cta: { label: "Kataloqa keç", href: "/products" },
    },
    about: {
      eyebrow: "Açıq Mənbəli Layihə",
      title: "Haqqımızda",
      intro:
        "qiymetleri.com - Azərbaycanda elektronika pərakəndə satışı bazarında şəffaflığı, dürüstlüyü və alıcı hüquqlarını təmin etmək üçün yaradılmış açıq mənbəli (open-source) real vaxt rejimli qiymət müqayisəsi və qiymət tarixçəsi platformasıdır.",
      sections: [
        {
          title: "Missiyamız və Baxışımız",
          body: "Müasir e-ticarət mühitində alıcıların qarşılaşdığı en böyük çətinliklərdən biri müxtəlif pərakəndə satış mağazalarındakı qiymət fərqliliklərini izləmək və süni endirim kampaniyalarını müəyyən etməkdir. qiymetleri.com böyük həcmli məlumatların (Big Data) avtomatik toplanması və analiz edilməsi texnologiyalarına əsaslanan tərəfsiz rəqəmsal infrastrukturdur.",
        },
        {
          title: "Açıq Mənbəli (Open-Source) Fəlsəfəmiz",
          body: "Biz inanırıq ki, rəqəmsal alətlər və məlumat şəffaflığı ictimai dəyərdir və kommersiya maraqlarının təsiri altında olmamalıdır. Platformanın backend, frontend və crawler kod bazası GitHub üzərindən icmaya tam açıqdır. Mozilla və GitHub prinsiplərinə uyğun olaraq alqoritmlərimiz şəffafdır, qiymət sıralamaları və tarixçə göstəriciləri manipulyasiya edilmir.",
        },
        {
          title: "Cəmiyyətə və İstifadəçilərə Qatdığımız Dəyər",
          body: "Platformamız ölkənin aparıcı elektronika şəbəkələrinin qiymətlərini real vaxt rejimində müqayisə edir. TimescaleDB time-series texnologiyası sayəsində məhsulların keçmiş qiymət dinamikasını təqdim edirik. Bu, alıcılara en sərfəli qiyməti tapmağa və endirimlərin real olduğunu görməyə imkan verir.",
        },
        {
          title: "Müstəqillik və Tərəfsizlik",
          body: "qiymetleri.com müstəqil informasiya platformasıdır və məhsul satışı ilə məşğul olmur. Sifariş, ödəniş, çatdırılma və zəmanət şərtləri birbaşa seçdiyiniz rəsmi mağaza tərəfindən həyata keçirilir.",
        },
      ],
      cta: { label: "Məhsul kataloquna bax", href: "/products" },
    },
    partnership: {
      eyebrow: "Biznes və İcma",
      title: "Tərəfdaşlıq və Əməkdaşlıq",
      intro:
        "qiymetleri.com elektronika pərakəndəçiləri, rəsmi distribütorlar, açıq mənbə tərtibatçıları və texnologiya tərəfdaşları ilə açıq, şəffaf və dürüst əməkdaşlığa hazırdır.",
      sections: [
        {
          title: "Korporativ Tərəfdaşlıq və Mağaza İnteqrasiyası",
          body: "Pərakəndə satış mağazaları ilə rəsmi API və ya məhsul feed-ləri vasitəsilə qiymət və stok məlumatlarının real vaxt rejimində daha dəqiq və vaxtında yenilənməsi üçün inteqrasiya imkanları təqdim edirik.",
        },
        {
          title: "Sponsorluq və Resurs Dəstəyi",
          body: "Açıq mənbəli layihə olaraq platformamız müstəqil bulud infrastrukturu üzərində fəaliyyət göstərir. Server xərclərini, verilənlər bazası saxlanılmasını və təhlükəsizlik alətlərini dəstəkləmək istəyən korporativ sponsorlar üçün əməkdaşlıq proqramlarımız mövcuddur.",
        },
        {
          title: "Açıq Mənbəli Layihəyə Töhfə Vermək (Contributing)",
          body: "Platformamızın inkişafı açıq mənbə icmasının dəstəyindən qidalanır. Proqramçılar, data mühəndisləri və dizaynerlər GitHub repozitoriyamızı fork edərək, parser-ləri təkmilləşdirərək və yeni funksiyalar üçün Pull Request göndərərək layihəyə töhfə verə bilərlər.",
        },
        {
          title: "Tərəfsizlik Teminatı",
          body: "Korporativ əməkdaşlıq və ya sponsorluq müqavilələri qiymetleri.com platformasındakı qiymət sıralamasına və ya qiymət tarixçəsi məlumatlarına təsir edə bilməz.",
        },
      ],
      cta: { label: "Tərəfdaşlıq üçün yazın", href: "mailto:partners@qiymetleri.com" },
    },
    social: {
      eyebrow: "İcma Və Ekosistem",
      title: "Sosial Şəbəkələr və İcma",
      intro:
        "qiymetleri.com təkcə qiymət müqayisə platforması deyil, rəqəmsal şəffaflığa inanan proqramçıların, analitiklərin və alıcıların birləşdiyi açıq mənbəli icmadır.",
      sections: [
        {
          title: "İcma Yönümlü Ekosistem",
          body: "Biz istifadəçilərimiz və tərtibatçılarımızla birbaşa dialoqu dəyərləndiririk. Platformanın gələcək inkişaf xəritəsini icmamızın rəy və təklifləri əsasında formalaşdırırıq.",
        },
        {
          title: "Sosial Media Kanallarımızı İzləməyin Üstünlükləri",
          body: "Rəsmi hesablarımızda elektronika bazarındakı real qiymət enişləri, platformaya əlavə edilən yeni funksiyalar, arxitektura yenilənmələri və texnoloji bələdçilər müntəzəm paylaşılır.",
        },
        {
          title: "GitHub İcması və Təcrübə Mübadiləsi",
          body: "GitHub repozitoriyamızda müzakirələrə qoşula, texniki suallarınızı verə, Scrapy, Playwright, FastAPI, Next.js və TimescaleDB kimi müasir texnologiyalar üzrə təcrübə mübadiləsi apara bilərsiniz.",
        },
        {
          title: "Rəsmi Hesablar",
          body: "Təsdiqlənmiş sosial media hesablarımızın və açıq kod resurslarımızın keçidləri platformamız üzərindən təqdim olunur.",
        },
      ],
      cta: { label: "GitHub-da bizə qoşulun", href: "https://github.com/reav4nn/qiymetleri.com" },
    },
    contact: {
      eyebrow: "Dəstək Və Əlaqə",
      title: "Əlaqə",
      intro:
        "İstifadəçi rəyləri, tərtibatçı təklifləri, mağaza inteqrasiyaları və ya texniki xətalar haqqında bizimlə istənilən vaxt əlaqə saxlaya bilərsiniz.",
      sections: [
        {
          title: "Ümumi Müraciətlər və İstifadəçi Dəstəyi",
          body: "Platformanın istifadəsi, məhsul məlumatlarında uyğunsuzluqlar və ya rəyləriniz üçün info@qiymetleri.com ünvanına yaza bilərsiniz.",
        },
        {
          title: "Tərəfdaşlıq və Mağaza İnteqrasiyaları",
          body: "Pərakəndə satıcılar, rəsmi distribütorlar və biznes təklifləri üçün partners@qiymetleri.com ünvanı vasitəsilə əlaqə yaradın.",
        },
        {
          title: "Açıq Mənbə Tərtibatçıları və Xəbərdarlıqlar (Bug Reports)",
          body: "Texniki xətalar, təhlükəsizlik xəbərdarlıqları və ya kod təklifləri üçün GitHub repozitoriyamızın Issues bölməsində müraciət yarada bilərsiniz.",
        },
        {
          title: "Cavablandırma Standartları",
          body: "Daxil olan bütün müraciətlərə iş günləri ərzində 24-48 saat müddətində diqqətlə baxılır və rəsmi cavab verilir.",
        },
      ],
      cta: { label: "E-poçt göndərin", href: "mailto:info@qiymetleri.com" },
    },
    terms: {
      eyebrow: "Hüquqi Məlumat",
      title: "Saytdan İstifadə Şərtləri",
      intro:
        "Bu İstifadə Şərtləri qiymetleri.com platformasından, onun açıq mənbəli proqram təminatından və təqdim edilən qiymət müqayisə xidmətlərindən istifadə qaydalarını tənzimləyir.",
      sections: [
        {
          title: "Ümumi Müddəalar və Şərtlərin Qəbulu",
          body: "qiymetleri.com müstəqil qiymət müqayisə platformasıdır. Sayta daxil olmaqla siz bu Şərtləri tam qəbul etmiş olursunuz. Platforma məhsul satmır; ödəniş, çatdırılma və zəmanət şərtləri seçdiyiniz rəsmi mağaza tərəfindən həyata keçirilir.",
        },
        {
          title: "Açıq Mənbəli Lisenziya və Məzmun İstifadəsi",
          body: "qiymetleri.com mənbə kodu açıq mənbəlidir. Siz kodu yoxlamaq, kopyalamaq və lisenziya şərtlərinə uyğun olaraq istifadə etmək hüququna maliksiniz. Platformadakı qiymət məlumatları və qrafiklər ictimai məlumatlandırma məqsədi daşıyır. Məlumatların avtomatlaşdırılmış toplanması platformanın işinə mane olmamaq şərtilə və mənbə göstərilməklə həyata keçirilməlidir.",
        },
        {
          title: "Məsuliyyətin Məhdudlaşdırılması və İmtah (Disclaimer)",
          body: "Məlumatlar mağazalardan avtomatlaşdırılmış alətlərlə toplanır. Biz məlumatların dəqiqliyinə çalışırıq, lakin anlıq qiymət dəyişikliklərinə və stok xətalarına görə zəmanət vermirik. Alış-veriş qərarı verərkən son qiyməti mağazanın öz rəsmi saytında yoxlamaq istifadəçinin məsuliyyətindədir.",
        },
        {
          title: "Ticarət Nişanları və Əqli Mülkiyyət",
          body: "Platformada nümayiş olunan mağaza adları, loqolar və məhsul şəkilləri müvafiq hüquq sahiblərinə (Kontakt Home, Baku Electronics, Irshad, iSpace və s.) məxsusdur. Onların nümayişi yalnız identifikasiya və informasiya məqsədi daşıyır.",
        },
        {
          title: "Şərtlərin Yenilənməsi",
          body: "Biz bu Şərtləri istənilən vaxt yeniləmək hüququnu saxlayırıq. Yenilənmiş şərtlər saytda dərc edildiyi andan qüvvəyə minir.",
        },
      ],
      cta: { label: "Bizimlə əlaqə", href: "mailto:info@qiymetleri.com" },
    },
    privacy: {
      eyebrow: "Hüquqi Məlumat",
      title: "Məxfilik Siyasəti",
      intro:
        "qiymetleri.com istifadəçilərin rəqəmsal məxfilik hüququna dərin hörmətlə yanaşır. WordPress və Mozilla məxfilik standartlarına uyğun olaraq, minimum məlumat toplanması (data minimization) və maksimum şəffaflıq prinsipinə sadiqik.",
      sections: [
        {
          title: "Bizim Məxfilik Fəlsəfəmiz",
          body: "Biz heç vaxt istifadəçilərimizin fərdi məlumatlarını satmırıq, kirayəyə vermirik və ya kommersiya məqsədli reklam şəbəkələrinə ötürmürük.",
        },
        {
          title: "Toplanan Məlumatlar",
          body: "Sayta daxil olduğunuz zaman serverlərimiz standart olaraq anonymized IP ünvanı, brauzer növü və daxilolma vaxtı kimi texniki log məlumatlarını qeydə alır. Bu məlumatlar yalnız platformanın təhlükəsizliyini təmin etmək və performansı optimallaşdırmaq üçün istifadə olunur.",
        },
        {
          title: "Çərəzlər (Cookies) və Anonim Analitika",
          body: "Platforma istifadəçi təcrübəsini yaxşılaşdırmaq (məsələn, seçilmiş dil tərcihini - AZ/RU xatırlamaq) və anonim statistik təhlillər aparmaq üçün minimal çərəzlərdən istifadə edir.",
        },
        {
          title: "Açıq Mənbə Şəffaflığı və Üçüncü Tərəf Keçidləri",
          body: "Platformamızın kodu açıq olduğu üçün məlumatların necə emal edildiyini istənilən şəxs kod səviyyəsində audit edə bilər. Mağaza keçidlərinə daxil olduqda həmin mağazanın öz məxfilik şərtləri keçərli olur.",
        },
      ],
      cta: { label: "Məxfilik sorğusu yazın", href: "mailto:privacy@qiymetleri.com" },
    },
    "personal-data": {
      eyebrow: "Hüquqi Məlumat",
      title: "Fərdi Məlumatlar",
      intro:
        "Fərdi məlumatların emalı və qorunması Azərbaycan Respublikasının 'Fərdi məlumatlar haqqında' Qanununa və GDPR beynəlxalq standartlarına uyğun olaraq həyata keçirilir.",
      sections: [
        {
          title: "Qanunvericilik və Emal Prinsipləri",
          body: "Fərdi məlumatlar yalnız qanuni, adil və əvvəlcədən bəyan edilmiş məqsədlər üçün emal olunur. Məlumatlar toplandığı məqsəddən kənar emal edilə bilməz.",
        },
        {
          title: "Məlumatların Saxlanması və Qorunması",
          body: "Məlumatların icazəsiz daxilolmalardan, dəyişdirilmədən və ya sızmadan qorunması üçün müasir şifrələmə (SSL/TLS), təhlükəsiz bulud infrastrukturu və daxili mühafizə protokolları tətbiq edilir.",
        },
        {
          title: "İstifadəçi Hüquqları (Right to be Forgotten)",
          body: "Hər bir istifadəçi öz fərdi məlumatları barədə məlumat almaq, düzəliş edilməsini və ya qanuni əsas olduqda sistemlərimizdən tam silinməsini tələb etmək hüququna malikdir.",
        },
        {
          title: "Sorğular və Müraciət",
          body: "Fərdi məlumatlar üzrə sorğularınızı privacy@qiymetleri.com ünvanına göndərə bilərsiniz. Müraciətlərə qanunla nəzərdə tutulmuş müddətdə cavab verilir.",
        },
      ],
      cta: { label: "Məlumat sorğusu göndərin", href: "mailto:privacy@qiymetleri.com" },
    },
    consent: {
      eyebrow: "Hüquqi Məlumat",
      title: "Məlumat Emalına Razılıq",
      intro:
        "qiymetleri.com platformasından istifadə etməklə, çərəz bildirişini təsdiqləməklə və ya bizimlə əlaqə saxlayarkən məlumatlarınızın bu sənəddə müəyyən edilmiş hüquqi çərçivədə emal edilməsinə razılıq vermiş olursunuz.",
      sections: [
        {
          title: "Razılığın Hüquqi Əsası",
          body: "İstifadəçinin verdiyi razılıq platformadan istifadə Şərtləri və Məxfilik Siyasəti ilə qarşılıqlı əlaqədə hüquqi çərçivə formalaşdırır.",
        },
        {
          title: "Razılığın Əhatə Dairəsi",
          body: "Verilən razılıq zəruri çərəzlərin yerləşdirilməsini, dil tərcihlərinin saxlanılmasını və platformanın təhlükəsizliyi üçün texniki log emalını əhatə edir.",
        },
        {
          title: "Könüllülük",
          body: "Məlumat təqdim etmək könüllüdür. Zəruri əlaqə vasitəsi olmadıqda sorğuya cavab vermək mümkün olmaya bilər.",
        },
        {
          title: "Razılığın Geri Götürülməsi Mexanizmi",
          body: "Brauzer parametrlərindən çərəzləri təmizləməklə və ya privacy@qiymetleri.com ünvanına yazaraq razılığınızı istənilən vaxt geri götürə bilərsiniz.",
        },
      ],
      cta: { label: "Dəstək komandasına yazın", href: "mailto:privacy@qiymetleri.com" },
    },
  },
  ru: {
    login: {
      eyebrow: "Личный кабинет",
      title: "Личный кабинет",
      intro:
        "Платформой qiymetleri.com можно пользоваться без регистрации. Каталог, поиск и сравнение цен полностью доступны каждому пользователю.",
      sections: [
        {
          title: "Текущие возможности",
          body: "Вы можете искать товары, сравнивать предложения магазинов и следить за динамикой цен.",
        },
        {
          title: "Предстоящие функции",
          body: "После запуска личного кабинета появится возможность сохранять товары в избранное и получать уведомления о снижении цен.",
        },
      ],
      cta: { label: "Перейти в каталог", href: "/products" },
    },
    about: {
      eyebrow: "Открытый исходный код",
      title: "О нас",
      intro:
        "qiymetleri.com - открытая (open-source) платформа реального времени для сравнения цен и истории цен на рынке электроники Азербайджана.",
      sections: [
        {
          title: "Наша миссия и видение",
          body: "Главная проблема покупателей в сфере e-commerce - отслеживание разницы цен в различных магазинах и определение искусственных скидок. qiymetleri.com - это независимая цифровая инфраструктура на базе технологий автоматического сбора данных (Big Data).",
        },
        {
          title: "Философия Open-Source",
          body: "Мы верим, что цифровые инструменты и прозрачность данных - это общественное благо. Исходный код нашего backend, frontend и скраперов полностью открыт на GitHub в соответствии с принципами Mozilla и GitHub.",
        },
        {
          title: "Ценность для пользователей",
          body: "Мы сравниваем цены ведущих сетей электроники страны в реальном времени. С помощью технологий TimescaleDB мы предоставляем историю цен, помогая находить самые выгодные предложения и проверять реальность скидок.",
        },
        {
          title: "Независимость",
          body: "qiymetleri.com не занимается продажей товаров. Заказ, оплата, доставка и гарантия оформляются напрямую в выбранном вами официальном магазине.",
        },
      ],
      cta: { label: "Смотреть каталог", href: "/products" },
    },
    partnership: {
      eyebrow: "Бизнес и Сообщество",
      title: "Партнерство и Сотрудничество",
      intro:
        "qiymetleri.com открыт к сотрудничеству с ритейлерами электроники, официальными дистрибьюторами и разработчиками открытого ПО.",
      sections: [
        {
          title: "Корпоративное партнерство и интеграция",
          body: "Мы предоставляем возможности интеграции через официальный API и фиды товаров для точного и своевременного обновления цен.",
        },
        {
          title: "Спонсорство и инфраструктура",
          body: "Платформа работает на независимой облачной инфраструктуре. Мы открыты к сотрудничеству с корпоративными спонсорами для поддержки серверов и баз данных.",
        },
        {
          title: "Вклад в Open-Source (Contributing)",
          body: "Разработчики и аналитики данных могут вносить вклад в проект через GitHub: улучшать парсеры, создавать Pull Request и развивать функционал.",
        },
        {
          title: "Гарантия объективности",
          body: "Партнерские соглашения не влияют на объективность ранжирования цен и график истории цен на qiymetleri.com.",
        },
      ],
      cta: { label: "Написать о партнерстве", href: "mailto:partners@qiymetleri.com" },
    },
    social: {
      eyebrow: "Сообщество",
      title: "Социальные сети и Сообщество",
      intro:
        "qiymetleri.com - это не только сервис сравнения цен, но и open-source сообщество разработчиков и пользователей, ценящих цифровую прозрачность.",
      sections: [
        {
          title: "Сообщество и диалог",
          body: "Мы ценим прямой диалог с пользователями и формируем дорожную карту развития платформы на основе ваших отзывов.",
        },
        {
          title: "Преимущества подписки",
          body: "В наших соцсетях публикуются обзоры реальных скидок, обновления архитектуры, новые функции и технические гайды.",
        },
        {
          title: "Сообщество GitHub",
          body: "Присоединяйтесь к дискуссиям на GitHub, задавайте технические вопросы и обменивайтесь опытом по стекe Scrapy, Playwright, FastAPI, Next.js и TimescaleDB.",
        },
        {
          title: "Официальные каналы",
          body: "Ссылки на подтвержденные аккаунты и исходный код доступны на нашем сайте.",
        },
      ],
      cta: { label: "Присоединиться на GitHub", href: "https://github.com/reav4nn/qiymetleri.com" },
    },
    contact: {
      eyebrow: "Поддержка и Контакты",
      title: "Контакты",
      intro:
        "Свяжитесь с нами по вопросам работы сайта, предложениям по партнерству или сообщениям об ошибках.",
      sections: [
        {
          title: "Общие вопросы и поддержка",
          body: "По вопросам использования платформы и неточностям в ценах пишите на info@qiymetleri.com.",
        },
        {
          title: "Партнерство и магазины",
          body: "Для интеграции магазинов и бизнес-предложений используйте partners@qiymetleri.com.",
        },
        {
          title: "Open-Source разработчикам (Bug Reports)",
          body: "Сообщения о багах и технические предложения отправляйте в раздел Issues на GitHub.",
        },
        {
          title: "Регламент ответов",
          body: "Все обращения рассматриваются в течение 24–48 часов в рабочие дни.",
        },
      ],
      cta: { label: "Отправить письмо", href: "mailto:info@qiymetleri.com" },
    },
    terms: {
      eyebrow: "Правовая информация",
      title: "Условия использования сайта",
      intro:
        "Настоящие условия регулируют правила использования сайта qiymetleri.com, его открытого исходного кода и сервиса сравнения цен.",
      sections: [
        {
          title: "Общие положения",
          body: "qiymetleri.com - независимый информационный сервис. Используя сайт, вы принимаете эти Условия. Сервис не продает товары; договор купли-продажи заключается с магазином.",
        },
        {
          title: "Лицензия Open-Source и контент",
          body: "Исходный код платформы распространяется по лицензии Open-Source. Графика и данные цен предназначены для общественного информирования. Автоматизированный сбор данных допускается при условии сохранения работоспособности сайта и указания ссылки на источник.",
        },
        {
          title: "Ограничение ответственности (Disclaimer)",
          body: "Данные собираются автоматически. Мы стремимся к точности, но не гарантируем отсутствие ошибок из-за мгновенных изменений цен в магазинах. Финальную цену необходимо проверять на сайте магазина.",
        },
        {
          title: "Товарные знаки",
          body: "Логотипы и названия брендов принадлежат их правообладателям и используются исключительно для идентификации.",
        },
        {
          title: "Изменение условий",
          body: "Мы оставляем за собой право обновлять данные Условия. Изменения вступают в силу с момента публикации.",
        },
      ],
      cta: { label: "Связаться с нами", href: "mailto:info@qiymetleri.com" },
    },
    privacy: {
      eyebrow: "Правовая информация",
      title: "Политика конфиденциальности",
      intro:
        "qiymetleri.com уважает право пользователей на конфиденциальность в соответствии со стандартами WordPress и Mozilla.",
      sections: [
        {
          title: "Философия конфиденциальности",
          body: "Мы никогда не продаем и не передаем персональные данные пользователей рекламодателям.",
        },
        {
          title: "Собираемые данные",
          body: "Серверы автоматически фиксируют технические данные (анонимизированный IP-адрес, тип браузера, время) исключительно для обеспечения безопасности и оптимизации сервиса.",
        },
        {
          title: "Файлы Cookie",
          body: "Используются минимальные cookie-файлы для сохранения настроек (язык AZ/RU) и анонимной аналитики.",
        },
        {
          title: "Прозрачность и сторонние ссылки",
          body: "Исходный код открыт для аудита. При переходе на сайты магазинов действуют их собственные правила конфиденциальности.",
        },
      ],
      cta: { label: "Написать по конфиденциальности", href: "mailto:privacy@qiymetleri.com" },
    },
    "personal-data": {
      eyebrow: "Правовая информация",
      title: "Персональные данные",
      intro:
        "Обработка персональных данных осуществляется в соответствии с Законом Азербайджанской Республики 'О персональных данных' и стандартами GDPR.",
      sections: [
        {
          title: "Принципы обработки",
          body: "Данные обрабатываются исключительно в законных и заранее заявленных целях.",
        },
        {
          title: "Защита данных",
          body: "Для защиты данных применяются современные протоколы шифрования (SSL/TLS) и меры защиты информации.",
        },
        {
          title: "Права пользователей",
          body: "Вы имеете право запрашивать информацию о своих данных, требовать их исправления или полного удаления из нашей системы.",
        },
        {
          title: "Запросы",
          body: "Направляйте запросы по персональным данным на privacy@qiymetleri.com.",
        },
      ],
      cta: { label: "Отправить запрос", href: "mailto:privacy@qiymetleri.com" },
    },
    consent: {
      eyebrow: "Правовая информация",
      title: "Согласие на обработку данных",
      intro:
        "Используя qiymetleri.com или обращаясь к нам, вы даете согласие на обработку ваших данных в рамках настоящих правил.",
      sections: [
        {
          title: "Правовая основа",
          body: "Согласие формирует правовую основу взаимодействия пользователя с сервисом.",
        },
        {
          title: "Объем согласия",
          body: "Согласие распространяется на использование необходимых cookie, сохранение настроек и обработку технических логов.",
        },
        {
          title: "Добровольность",
          body: "Предоставление данных является добровольным.",
        },
        {
          title: "Отзыв согласия",
          body: "Вы можете отозвать согласие, очистив cookie в браузере или направив письмо на privacy@qiymetleri.com.",
        },
      ],
      cta: { label: "Написать в поддержку", href: "mailto:privacy@qiymetleri.com" },
    },
  },
};
