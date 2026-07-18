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
      eyebrow: "Şəxsi kabinet",
      title: "Qiymətləri hesab yaratmadan müqayisə et",
      intro:
        "İstifadəçi hesabları hələ aktiv deyil. Kataloq, axtarış və qiymət tarixçəsi qeydiyyatsız tam açıqdır.",
      sections: [
        {
          title: "Hazırda nə işləyir?",
          body: "Məhsulları axtara, mağaza qiymətlərini müqayisə edə və son qiymət dəyişikliklərinə baxa bilərsiniz.",
        },
        {
          title: "Növbəti imkanlar",
          body: "Şəxsi kabinet aktivləşdikdə seçilmiş məhsullar, qiymət bildirişləri və fərdi izləmə siyahıları əlavə olunacaq.",
        },
      ],
      cta: { label: "Kataloqa keç", href: "/products" },
    },
    about: {
      eyebrow: "Məlumat",
      title: "Qiymət müqayisəsini sadələşdiririk",
      intro:
        "qiymetleri.com Azərbaycandakı elektronika mağazalarının təkliflərini bir yerdə göstərən müstəqil qiymət müqayisə platformasıdır.",
      sections: [
        {
          title: "Məqsədimiz",
          body: "Alıcının müxtəlif saytları ayrıca yoxlamadan məhsul, mağaza və qiymət barədə aydın qərar verməsinə kömək etməkdir.",
        },
        {
          title: "Məlumat necə işləyir?",
          body: "Açıq mağaza səhifələrindən alınan məhsul məlumatları normallaşdırılır, uyğun məhsullar qruplaşdırılır və qiymət tarixçəsi saxlanılır.",
        },
        {
          title: "Müstəqillik",
          body: "Platforma məhsul satmır. Sifariş, ödəniş, çatdırılma və zəmanət seçilmiş mağazanın şərtlərinə əsasən həyata keçirilir.",
        },
      ],
      cta: { label: "Məhsullara bax", href: "/products" },
    },
    partnership: {
      eyebrow: "Biznes",
      title: "Mağazanızın təkliflərini daha görünən edin",
      intro:
        "Elektronika mağazaları və məlumat tərəfdaşları ilə dəqiq, yenilənən və istifadəçiyə faydalı kataloq qurmaq üçün əməkdaşlığa açığıq.",
      sections: [
        {
          title: "Mağazalar üçün",
          body: "Məhsul feed-i və ya API inteqrasiyası qiymətlərin daha tez yenilənməsinə, düzgün stok məlumatına və keyfiyyətli məhsul uyğunlaşdırmasına imkan verir.",
        },
        {
          title: "İnteqrasiya prosesi",
          body: "Kataloq formatı birlikdə yoxlanılır, test idxalı aparılır və məlumat keyfiyyəti təsdiqləndikdən sonra mağaza aktiv edilir.",
        },
        {
          title: "Redaksiya prinsipi",
          body: "Ödənişli əməkdaşlıq nəticələrin dəqiqliyini və müqayisənin şəffaflığını dəyişmir. Qiymət və mövcudluq əsas göstəricilər olaraq qalır.",
        },
      ],
      cta: { label: "Tərəfdaşlıq üçün yazın", href: "mailto:partners@qiymetleri.com" },
    },
    social: {
      eyebrow: "İcma",
      title: "Qiymət yeniliklərini izləyin",
      intro:
        "Sosial kanallarımızda qiymət enişləri, yeni mağazalar və məhsul müqayisəsi ilə bağlı qısa məlumatlar paylaşılacaq.",
      sections: [
        {
          title: "Endirim siqnalları",
          body: "Kataloqda nəzərəçarpan qiymət dəyişikliyi olduqda seçilmiş məhsullar barədə icmal paylaşırıq.",
        },
        {
          title: "Məhsul bələdçiləri",
          body: "Oxşar modellərin əsas fərqlərini və alış zamanı yoxlanmalı məqamları sadə dildə izah edirik.",
        },
        {
          title: "Rəsmi hesablar",
          body: "Aktiv sosial hesabların təsdiqlənmiş keçidləri istifadəyə verildikcə yalnız bu səhifədə yerləşdiriləcək.",
        },
      ],
      cta: { label: "Yenilik təklif edin", href: "mailto:info@qiymetleri.com" },
    },
    contact: {
      eyebrow: "Dəstək",
      title: "Bizimlə əlaqə saxlayın",
      intro:
        "Yanlış qiymət, çatışmayan məhsul, mağaza inteqrasiyası və ya platforma ilə bağlı sualınızı e-poçtla göndərə bilərsiniz.",
      sections: [
        {
          title: "Ümumi müraciətlər",
          body: "info@qiymetleri.com ünvanına məhsulun linkini və gördüyünüz problemi əlavə edin. Bu, yoxlamanı sürətləndirir.",
        },
        {
          title: "Tərəfdaşlıq",
          body: "Mağaza, kataloq və API inteqrasiyası üçün partners@qiymetleri.com ünvanından istifadə edin.",
        },
        {
          title: "Məkan",
          body: "Platforma Bakı, Azərbaycan vaxt qurşağı ilə fəaliyyət göstərir. Dəstək müraciətləri iş günlərində emal olunur.",
        },
      ],
      cta: { label: "E-poçt göndər", href: "mailto:info@qiymetleri.com" },
    },
    terms: {
      eyebrow: "Hüquqi · 18 iyul 2026",
      title: "İstifadə şərtləri",
      intro:
        "Bu şərtlər qiymetleri.com saytından və təqdim olunan qiymət müqayisəsi məlumatlarından istifadə qaydasını müəyyən edir.",
      sections: [
        {
          title: "Xidmətin mahiyyəti",
          body: "Sayt məlumat və müqayisə xidmətidir, məhsul satıcısı deyil. Alış müqaviləsi istifadəçi ilə seçilmiş mağaza arasında bağlanır.",
        },
        {
          title: "Qiymətlərin dəqiqliyi",
          body: "Məlumatları tez-tez yeniləsək də mağaza qiyməti və stok vəziyyəti dəyişə bilər. Sifarişdən əvvəl yekun məlumatı mağaza səhifəsində yoxlayın.",
        },
        {
          title: "İcazəli istifadə",
          body: "Xidmət şəxsi və qanuni məqsədlər üçün istifadə edilə bilər. Sistemin işinə mane olmaq, məlumatı icazəsiz kütləvi çıxarmaq və təhlükəsizlik tədbirlərini keçmək qadağandır.",
        },
        {
          title: "Xarici keçidlər",
          body: "Mağaza saytlarının məzmunu, ödənişi, çatdırılması və zəmanət şərtləri həmin tərəflərin məsuliyyətindədir.",
        },
      ],
      cta: { label: "Sualınız var?", href: "mailto:info@qiymetleri.com" },
    },
    privacy: {
      eyebrow: "Hüquqi · 18 iyul 2026",
      title: "Gizlilik və təhlükəsizlik",
      intro:
        "Məxfiliyə məlumatın minimum toplanması, məqsədli istifadəsi və uyğun texniki qorunması prinsipi ilə yanaşırıq.",
      sections: [
        {
          title: "Toplanan texniki məlumat",
          body: "Xidmətin təhlükəsizliyi və işləkliyi üçün IP ünvanı, brauzer tipi, sorğu vaxtı və xəta qeydləri kimi məhdud texniki məlumat emal oluna bilər.",
        },
        {
          title: "İstifadə məqsədi",
          body: "Məlumat təhlükəsizlik insidentlərini aşkarlamaq, performansı ölçmək, xətaları aradan qaldırmaq və xidməti yaxşılaşdırmaq üçün istifadə olunur.",
        },
        {
          title: "Qorunma və saxlanma",
          body: "Girişlər məhdudlaşdırılır, sirrlər açıq repoda saxlanmır və texniki qeydlər yalnız zəruri müddət ərzində qorunur.",
        },
        {
          title: "Üçüncü tərəflər",
          body: "Mağaza keçidinə daxil olduqda həmin saytın məxfilik qaydaları tətbiq edilir. Onların məlumat emalına qiymetleri.com nəzarət etmir.",
        },
      ],
      cta: { label: "Məxfilik barədə yazın", href: "mailto:privacy@qiymetleri.com" },
    },
    "personal-data": {
      eyebrow: "Hüquqi · 18 iyul 2026",
      title: "Fərdi məlumatların qorunması",
      intro:
        "Fərdi məlumat yalnız aydın məqsəd olduqda, zəruri həcmdə və qüvvədə olan tələblərə uyğun emal edilir.",
      sections: [
        {
          title: "Məlumat subyektinin hüquqları",
          body: "Sizinlə bağlı saxlanılan məlumatın mövcudluğu barədə sorğu göndərə, düzəliş və ya qanuni əsas olduqda silinmə tələb edə bilərsiniz.",
        },
        {
          title: "Emalın hüquqi əsası",
          body: "Məlumat razılıq, xidmətin göstərilməsi, təhlükəsizlik üzrə qanuni maraq və ya hüquqi öhdəlik əsasında emal oluna bilər.",
        },
        {
          title: "Sorğular",
          body: "Məlumat sorğusunda kimliyin təsdiqi üçün əlavə məlumat istənilə bilər. Cavab qanunla nəzərdə tutulan müddətdə təqdim edilir.",
        },
      ],
      cta: { label: "Məlumat sorğusu göndər", href: "mailto:privacy@qiymetleri.com" },
    },
    consent: {
      eyebrow: "Hüquqi · 18 iyul 2026",
      title: "Məlumat emalına razılıq",
      intro:
        "Bizə könüllü şəkildə müraciət göndərdikdə təqdim etdiyiniz məlumatın müraciəti cavablandırmaq üçün emalına razılıq vermiş olursunuz.",
      sections: [
        {
          title: "Razılığın əhatəsi",
          body: "Ad, e-poçt ünvanı və müraciətdə yazdığınız digər məlumat yalnız əlaqə, dəstək və sorğunun icrası məqsədilə istifadə edilir.",
        },
        {
          title: "Könüllülük",
          body: "Məlumat təqdim etmək könüllüdür. Zəruri əlaqə məlumatı olmadıqda müraciətə cavab vermək mümkün olmaya bilər.",
        },
        {
          title: "Razılığın geri götürülməsi",
          body: "privacy@qiymetleri.com ünvanına yazaraq razılığı geri götürə bilərsiniz. Bu, geri götürülmədən əvvəlki qanuni emala təsir etmir.",
        },
      ],
      cta: { label: "Bizimlə əlaqə", href: "mailto:privacy@qiymetleri.com" },
    },
  },
  ru: {
    login: {
      eyebrow: "Личный кабинет",
      title: "Сравнивайте цены без регистрации",
      intro:
        "Учетные записи пользователей пока не активированы. Каталог, поиск и история цен полностью доступны без регистрации.",
      sections: [
        {
          title: "Что уже работает?",
          body: "Вы можете искать товары, сравнивать предложения магазинов и просматривать последние изменения цен.",
        },
        {
          title: "Следующие возможности",
          body: "После запуска кабинета появятся избранные товары, уведомления о снижении цены и персональные списки наблюдения.",
        },
      ],
      cta: { label: "Перейти в каталог", href: "/products" },
    },
    about: {
      eyebrow: "Информация",
      title: "Упрощаем сравнение цен",
      intro:
        "qiymetleri.com — независимая платформа, которая собирает предложения азербайджанских магазинов электроники в одном месте.",
      sections: [
        {
          title: "Наша цель",
          body: "Помочь покупателю принять понятное решение о товаре, магазине и цене без отдельной проверки множества сайтов.",
        },
        {
          title: "Как работают данные?",
          body: "Данные с открытых страниц магазинов нормализуются, одинаковые товары объединяются, а изменения цен сохраняются в истории.",
        },
        {
          title: "Независимость",
          body: "Платформа не продает товары. За заказ, оплату, доставку и гарантию отвечает выбранный магазин на своих условиях.",
        },
      ],
      cta: { label: "Смотреть товары", href: "/products" },
    },
    partnership: {
      eyebrow: "Бизнес",
      title: "Сделайте предложения магазина заметнее",
      intro:
        "Мы открыты к сотрудничеству с магазинами электроники и поставщиками данных ради точного и регулярно обновляемого каталога.",
      sections: [
        {
          title: "Для магазинов",
          body: "Интеграция товарного фида или API ускоряет обновление цен, улучшает данные о наличии и качество сопоставления товаров.",
        },
        {
          title: "Процесс интеграции",
          body: "Мы вместе проверяем формат каталога, выполняем тестовый импорт и активируем магазин после контроля качества данных.",
        },
        {
          title: "Редакционный принцип",
          body: "Коммерческое сотрудничество не влияет на точность результатов и прозрачность сравнения. Главными остаются цена и наличие.",
        },
      ],
      cta: { label: "Обсудить партнерство", href: "mailto:partners@qiymetleri.com" },
    },
    social: {
      eyebrow: "Сообщество",
      title: "Следите за ценовыми новостями",
      intro:
        "В социальных каналах будут публиковаться короткие новости о снижении цен, новых магазинах и сравнении товаров.",
      sections: [
        {
          title: "Сигналы о скидках",
          body: "При заметном изменении цены в каталоге мы публикуем обзор выбранных товаров.",
        },
        {
          title: "Гиды по товарам",
          body: "Простым языком объясняем основные различия похожих моделей и важные моменты перед покупкой.",
        },
        {
          title: "Официальные аккаунты",
          body: "Ссылки на подтвержденные активные аккаунты будут размещаться только на этой странице по мере их запуска.",
        },
      ],
      cta: { label: "Предложить тему", href: "mailto:info@qiymetleri.com" },
    },
    contact: {
      eyebrow: "Поддержка",
      title: "Свяжитесь с нами",
      intro:
        "Сообщите по электронной почте о неверной цене, отсутствующем товаре, интеграции магазина или другом вопросе о платформе.",
      sections: [
        {
          title: "Общие обращения",
          body: "Напишите на info@qiymetleri.com и приложите ссылку на товар и описание проблемы — это ускорит проверку.",
        },
        {
          title: "Партнерство",
          body: "По вопросам магазина, каталога и API-интеграции используйте partners@qiymetleri.com.",
        },
        {
          title: "Регион",
          body: "Платформа работает по часовому поясу Баку, Азербайджан. Обращения поддержки обрабатываются в рабочие дни.",
        },
      ],
      cta: { label: "Отправить письмо", href: "mailto:info@qiymetleri.com" },
    },
    terms: {
      eyebrow: "Правовая информация · 18 июля 2026",
      title: "Условия использования",
      intro:
        "Эти условия регулируют использование сайта qiymetleri.com и предоставляемых данных для сравнения цен.",
      sections: [
        {
          title: "Характер сервиса",
          body: "Сайт является информационным сервисом сравнения, а не продавцом. Договор покупки заключается между пользователем и выбранным магазином.",
        },
        {
          title: "Точность цен",
          body: "Хотя данные регулярно обновляются, цена и наличие в магазине могут измениться. Перед заказом проверьте итоговую информацию на сайте магазина.",
        },
        {
          title: "Допустимое использование",
          body: "Сервис разрешено использовать в личных и законных целях. Запрещено нарушать работу системы, массово извлекать данные без разрешения и обходить меры защиты.",
        },
        {
          title: "Внешние ссылки",
          body: "За содержание, оплату, доставку и гарантийные условия на сайтах магазинов отвечают соответствующие третьи стороны.",
        },
      ],
      cta: { label: "Задать вопрос", href: "mailto:info@qiymetleri.com" },
    },
    privacy: {
      eyebrow: "Правовая информация · 18 июля 2026",
      title: "Конфиденциальность и безопасность",
      intro:
        "Мы придерживаемся принципов минимального сбора данных, целевого использования и надлежащей технической защиты.",
      sections: [
        {
          title: "Технические данные",
          body: "Для безопасности и работоспособности могут обрабатываться ограниченные технические данные: IP-адрес, тип браузера, время запроса и записи об ошибках.",
        },
        {
          title: "Цели использования",
          body: "Данные используются для выявления угроз, измерения производительности, устранения ошибок и улучшения сервиса.",
        },
        {
          title: "Защита и хранение",
          body: "Доступ ограничивается, секреты не хранятся в открытом репозитории, а технические журналы сохраняются только необходимое время.",
        },
        {
          title: "Третьи стороны",
          body: "При переходе на сайт магазина действуют его правила конфиденциальности. qiymetleri.com не управляет обработкой данных на этих сайтах.",
        },
      ],
      cta: { label: "Вопрос о конфиденциальности", href: "mailto:privacy@qiymetleri.com" },
    },
    "personal-data": {
      eyebrow: "Правовая информация · 18 июля 2026",
      title: "Защита персональных данных",
      intro:
        "Персональные данные обрабатываются только при наличии понятной цели, в необходимом объеме и в соответствии с применимыми требованиями.",
      sections: [
        {
          title: "Права субъекта данных",
          body: "Вы можете запросить сведения о хранящихся данных, их исправление или удаление при наличии законных оснований.",
        },
        {
          title: "Правовое основание",
          body: "Обработка может основываться на согласии, оказании сервиса, законном интересе в безопасности или юридической обязанности.",
        },
        {
          title: "Запросы",
          body: "Для подтверждения личности при запросе могут потребоваться дополнительные сведения. Ответ предоставляется в установленный законом срок.",
        },
      ],
      cta: { label: "Отправить запрос", href: "mailto:privacy@qiymetleri.com" },
    },
    consent: {
      eyebrow: "Правовая информация · 18 июля 2026",
      title: "Согласие на обработку данных",
      intro:
        "Добровольно отправляя обращение, вы соглашаетесь на обработку предоставленных данных для подготовки ответа.",
      sections: [
        {
          title: "Объем согласия",
          body: "Имя, адрес электронной почты и иные сведения из обращения используются только для связи, поддержки и исполнения запроса.",
        },
        {
          title: "Добровольность",
          body: "Предоставление данных добровольно. Без необходимых контактных сведений ответить на обращение может быть невозможно.",
        },
        {
          title: "Отзыв согласия",
          body: "Согласие можно отозвать письмом на privacy@qiymetleri.com. Это не влияет на законность обработки до момента отзыва.",
        },
      ],
      cta: { label: "Связаться с нами", href: "mailto:privacy@qiymetleri.com" },
    },
  },
};
