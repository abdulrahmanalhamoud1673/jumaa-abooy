// The week. Each day is one or more segments; a segment sets the light, dad's routine and your jobs.
// Step kinds: use (hold at a spot), pick/drop/give (carry something), stay (accumulate seconds doing something),
// check (a condition that must be true), goto. '@bed', '@desk', '@wardrobe', '@pile' resolve to your own furniture.

export const ITEMS = {
  talabat: 'طلبك من طلبات',
  gasEmpty: 'الجرّة الفاضية', gasFull: 'الجرّة المليانة', veg: 'كيس الخضرة',
  tea: 'صينية الشاي', water: 'كاسة المي', remote: 'الريموت', glasses: 'نظارات أبوك', charger: 'الشاحن', paper: 'الجريدة',
  slipper: 'الشبشب', laundry: 'الغسيل', trash: 'كيس الزبالة', tomato: 'البندورة', chocolate: 'الشوكولاتة', kunafa: 'صينية الكنافة',
  cups: 'فناجين الضيوف', coffee: 'صينية القهوة', socks: 'الجرابات', clothes: 'الغسيل الناشف', toys: 'أغراضك', mansaf: 'سدر المنسف',
  laban: 'اللبن', plate: 'الصحن الوسخ', vase: 'قطع المزهرية', wet: 'الغسيل المبلول',
};
export const TRAY = new Set(['tea', 'coffee', 'kunafa', 'mansaf', 'cups', 'laundry', 'clothes', 'wet']);

const P = { kitchen: [13.4, 9.0], hallE: [13.2, 5.5], hallW: [3.2, 5.5], hallM: [8, 5.5], boys: [13.2, 3.0], sis: [8.9, 3.3], parents: [3.0, 3.5],
  bath: [5.75, 3.6], salon: [2.6, 7.9], yard: [17.6, 6.6], living: [7.6, 10.4], door: [14.9, 5.5], table: [13.55, 8.5] };
const look = (p, a = 4, b = 6, extra = {}) => ({ at: P[p], act: 'look', dur: [a, b], ...extra });
const tv = (a, b, extra = {}) => ({ seat: 'dadTv', act: 'tv', dur: [a, b], ...extra });

const use = (id, title, spot, secs, extra = {}) => ({ id, title, kind: 'chore', steps: [{ use: spot, secs }], ...extra });
const carry = (id, title, item, from, to, extra = {}) => ({ id, title, kind: 'chore', steps: [{ pick: item, at: from, secs: 1.2 }, { drop: item, at: to, secs: 1.3 }], ...extra });
const study = (secs) => ({ id: 'study', title: `ادرس ${secs} ثانية على مكتبك`, kind: 'chore', steps: [{ stay: '@desk', secs, act: 'study', sit: true, label: 'ادرس' }] });
// order from talabat on the phone, take it from the captain at the gate, eat it where dad will not see
const talabat = () => ({ id: 'talabat', title: 'اطلب أكل من طلبات، استلمه من الكابتن وكله بالسر', kind: 'secret', steps: [{ phone: 3, order: true, label: 'اطلب من التطبيق' }, { pick: 'talabat', at: 'gate', secs: 2.2, act: 'talabat', label: 'استلم الطلب من الكابتن' }, { eat: 6, item: 'talabat', label: 'كُل بالسر' }] });
const secretPs = (secs) => ({ id: 'ps', title: `العب بلايستيشن ${secs} ثانية بدون ما حدا يشوفك`, kind: 'secret', only: ['big', 'kid'], steps: [{ stay: 'console', secs, act: 'ps', device: 'console', sit: true, label: 'العب' }] });
const secretPhone = (secs, only) => ({ id: 'phone', title: `اقعد عالتلفون ${secs} ثانية بدون ما حدا يشوفك`, kind: 'secret', only, steps: [{ phone: secs }] });

export const COMMANDS = {
  tea: { title: 'اعمل شاي لأبوك', line: 'dad.cmd.tea', time: 42, steps: [{ pick: 'tea', at: 'kettle', secs: 3, label: 'اعمل شاي' }, { give: 'tea', to: 'dad' }] },
  water: { title: 'جيب مي لأبوك', line: 'dad.cmd.water', time: 30, steps: [{ pick: 'water', at: 'cooler', secs: 1.2, label: 'عبّي كاسة' }, { give: 'water', to: 'dad' }] },
  remote: { title: 'دوّر عالريموت', line: 'dad.cmd.remote', time: 38, steps: [{ find: 'remote', spots: ['coffeetable', 'kitchentable', 'desk_boys', 'nightstand', 'halltable', 'salontable'] }, { give: 'remote', to: 'dad' }] },
  glasses: { title: 'جيب نظارات أبوك', line: 'dad.cmd.glasses', time: 38, steps: [{ find: 'glasses', spots: ['nightstand', 'sink', 'kitchentable', 'halltable', 'coffeetable'] }, { give: 'glasses', to: 'dad' }] },
  charger: { title: 'جيب الشاحن الأصلي', line: 'dad.cmd.charger', time: 38, steps: [{ find: 'charger', spots: ['desk_boys', 'desk_sis', 'nightstand', 'kitchentable'] }, { give: 'charger', to: 'dad' }] },
  paper: { title: 'جيب الجريدة من عند الباب', line: 'dad.cmd.paper', time: 36, steps: [{ pick: 'paper', at: 'gate', secs: 0.8 }, { give: 'paper', to: 'dad' }] },
  slipper: { title: 'رجّع الشبشب لأبوك', line: 'dad.cmd.slipper', time: 26, steps: [{ find: 'slipper' }, { give: 'slipper', to: 'dad' }] },
  door: { title: 'افتح الباب', line: 'dad.cmd.door', time: 20, steps: [{ use: 'maindoor', secs: 1.2, label: 'افتح' }] },
  light: { title: 'طفّي الضو اللي أبوك شايفه', line: 'dad.cmd.light', time: 24, steps: [{ check: 'noWaste', label: 'طفّي كل ضو زايد' }] },
  callmom: { title: 'نادي أمك', line: 'dad.cmd.callmom', time: 24, steps: [{ give: null, to: 'mom', label: 'أبوي بده إياكي' }] },
};

export const PUNISH = [
  { id: 'p_car', title: 'عقاب: اغسل السيارة', kind: 'punish', steps: [{ use: 'tap', secs: 1.5, label: 'عبّي السطل' }, { use: 'car1', secs: 3 }, { use: 'car3', secs: 3 }] },
  { id: 'p_sweep', title: 'عقاب: كنّس الحوش', kind: 'punish', steps: [{ use: 'sweep1', secs: 2 }, { use: 'sweep2', secs: 2 }, { use: 'sweep3', secs: 2 }] },
  { id: 'p_plants', title: 'عقاب: اسقي الزريعة', kind: 'punish', steps: [{ use: 'tap', secs: 1.5, label: 'عبّي مي' }, { use: 'plant1', secs: 1.5 }, { use: 'plant2', secs: 1.5 }, { use: 'plant3', secs: 1.5 }] },
  { id: 'p_dishes', title: 'عقاب: الجلي كله عليك', kind: 'punish', steps: [{ use: 'kitchensink', secs: 7, noise: 4, label: 'اجلي' }] },
];

export const MOM_TASKS = [
  { title: 'قطّع البندورة لأمك', steps: [{ use: 'counter', secs: 4.5, label: 'قطّع', veg: 'tomato' }] },
  { title: 'جيب بندورة لأمك من الثلاجة', steps: [{ pick: 'tomato', at: 'fridge', secs: 1.2 }, { give: 'tomato', to: 'mom' }] },
  { title: 'انشر الغسيل عالحبل', steps: [{ pick: 'wet', at: 'washer', secs: 1.5 }, { drop: 'wet', at: 'clothesline', secs: 3 }] },
  { title: 'نزّل الزبالة', steps: [{ pick: 'trash', at: 'bin', secs: 1 }, { drop: 'trash', at: 'yardbin', secs: 1 }] },
  { title: 'قطّع البصل لأمك', steps: [{ use: 'counter', secs: 5, label: 'قطّع', veg: 'onion' }] },
];

export const DAYS = [
  { id: 'sat', name: 'السبت', title: 'تعزيل البيت', intro: 'dad.intro.sat',
    blurb: 'عطلة. أبوك قاعد بالبيت ومعه الجريدة، يعني عينه عليك طول النهار. خلّص شغل البيت… وإذا لقيت فرصة، العب شوي.',
    segs: [{
      tod: 'day', time: 300, clock: [10 * 60, 13 * 60], end: 'tasks', lightsOn: ['boys', 'sis', 'bath', 'hall'], visitor: [50, 85], vendors: { veg: [20, 45] }, roof: [150, 210],
      dad: { mode: 'patrol', pace: 1.2, cmds: ['tea', 'water'], cmdEvery: [48, 66],
        plan: [tv(26, 38, { paper: true }), look('kitchen'), look('hallE', 2, 3), look('boys', 4, 6, { line: 'dad.sat' }), tv(22, 32, { paper: true }), look('sis', 3, 5), look('parents', 5, 8), look('yard', 5, 8)] },
      sibs: { chaos: [55, 80] },
      tasks: [
        talabat(),
        use('bed', 'رتّب تختك', '@bed', 3),
        carry('laundry', 'ودّي غسيلك عالغسّالة', 'laundry', '@pile', 'washer'),
        { id: 'waste', title: 'طفّي كل ضو مالوش لزوم', kind: 'chore', steps: [{ check: 'noWaste', label: 'في أضوية شغّالة عالفاضي' }] },
        carry('trash', 'نزّل الزبالة عالحاوية برا', 'trash', 'bin', 'yardbin'),
        secretPs(20), secretPhone(20, ['sis']),
      ],
    }] },

  { id: 'sun', name: 'الأحد', title: 'باص المدرسة', intro: 'dad.intro.sun',
    blurb: 'أول يوم دوام. أبوك بالسيارة وإيده عالزمور، وكل ثانية تأخير بتطلع من أعصابه. جهّز حالك وانزل… وإذا بتقدر، نام خمس دقايق كمان.',
    segs: [{
      tod: 'morning', time: 150, clock: [6 * 60 + 40, 7 * 60 + 15], end: 'car', startAsleep: true, bathBusy: 24, lightsOn: ['hall', 'kitchen'],
      dad: { mode: 'car', plan: [look('hallE', 2, 3, { line: 'dad.sun' }), look('boys', 3, 4), look('sis', 2, 3), look('bath', 2, 3)], pace: 2.0 },
      events: [{ t: 70, storm: 36 }],
      sibs: {}, slipper: false,
      tasks: [
        use('wash', 'غسّل وجهك', 'sink', 2.5),
        use('dress', 'البس أواعي المدرسة', '@wardrobe', 3),
        use('bag', 'حضّر الشنطة', '@desk', 2.5),
        { id: 'socks', title: 'لاقي الجرابات', kind: 'chore', steps: [{ find: 'socks', spots: ['coffeetable', 'washer', 'kitchentable', 'halltable', 'shoes'] }] },
        use('breakfast', 'افطر لقمة', 'kitchentable', 3.5),
        { id: 'car', title: 'انزل عالسيارة', kind: 'chore', needs: ['wash', 'dress', 'bag', 'socks', 'breakfast'], steps: [{ goto: 'carhorn', label: 'اركب' }] },
        { id: 'sleep', title: 'نام 10 ثواني كمان', kind: 'secret', steps: [{ stay: '@bed', secs: 10, act: 'sleep', lie: true, label: 'نام' }] },
      ],
    }] },

  { id: 'mon', name: 'الاثنين', title: 'فاتورة الكهربا', intro: 'dad.intro.mon',
    blurb: 'أجت الفاتورة. أبوك بيلف عالغرف غرفة غرفة، وأخوك الصغير بيشعّل وراه. لازم تدرس وتتحمم (والسخّان بياكل كهربا!) والبيت يضل مطفّي.',
    segs: [{
      tod: 'night', time: 240, clock: [19 * 60, 22 * 60], end: 'time', final: 'noWaste', lightsOn: ['living', 'kitchen', 'hall'], vendors: { gas: [25, 60] },
      dad: { mode: 'patrol', pace: 1.5, strict: 1.6, cmds: ['light', 'water'], cmdEvery: [45, 62],
        plan: [tv(12, 18), look('kitchen', 3, 4), look('hallE', 2, 3), look('boys', 3, 5), look('sis', 3, 4), look('bath', 2, 3, { line: 'dad.mon' }), look('parents', 3, 4), look('salon', 3, 4)] },
      sibs: { chaos: [22, 34] },
      tasks: [
        talabat(),
        study(30),
        { id: 'shower', title: 'تحمّم (السخّان أول!)', kind: 'chore', steps: [{ check: 'heaterOn', label: 'شغّل السخّان من الممر' }, { wait: 12, check: 'heaterOn', label: 'استنى المي تسخن' }, { use: 'shower', secs: 5, label: 'تحمّم' }, { check: 'heaterOff', label: 'طفّي السخّان قبل ما يشوفه!' }] },
        { id: 'tvw', title: 'احضر تلفزيون 20 ثانية وأبوك مش بالغرفة', kind: 'secret', steps: [{ stay: 'tv', secs: 20, act: 'tvwatch', device: 'tv', label: 'احضر' }] },
      ],
    }] },

  { id: 'tue', name: 'الثلاثاء', title: 'نشرة الأخبار', intro: 'dad.intro.tue',
    blurb: 'أبوك قاعد قدام الأخبار وبده هدوء… وبنفس الوقت بده شاي ومي ونظارات وريموت. لا تمرق قدام التلفزيون واقف: وطّي راسك (تسلل) وامرق.',
    segs: [{
      tod: 'night', time: 270, clock: [20 * 60, 22 * 60 + 30], end: 'time', lightsOn: ['living', 'kitchen', 'hall'], roof: [55, 110],
      dad: { mode: 'tv', quiet: true, cmds: ['tea', 'water', 'remote', 'glasses', 'charger', 'paper'], cmdEvery: [20, 30], maxCmds: 2,
        plan: [tv(60, 85), look('kitchen', 3, 5), tv(50, 70), look('hallM', 3, 4)] },
      sibs: { chaos: [50, 75] },
      tasks: [
        use('dishes', 'اجلي الصحون', 'kitchensink', 6, { noise: 4 }),
        carry('clothes', 'لمّ الغسيل عن الحبل', 'clothes', 'clothesline', '@wardrobe'),
        study(20),
        secretPhone(25),
        { id: 'choc', title: 'كل شوكولاتة من خزانة المطبخ', kind: 'secret', steps: [{ pick: 'chocolate', at: 'cupboard', secs: 2, high: true, label: 'خذ شوكولاتة' }, { eat: 3 }] },
      ],
    }] },

  { id: 'wed', name: 'الأربعاء', title: 'الشهادة', intro: 'dad.intro.wed',
    blurb: 'بالشنطة شهادة فيها 45 بالرياضيات ولازم تنوقّع. إذا قرأها أبوك راحت عليك. استنى لحظة رواق: بعد كاسة شاي وهو بيحضر التلفزيون… أو خلّي أمك تدبّرها.',
    segs: [{
      tod: 'evening', time: 270, clock: [16 * 60, 19 * 60], end: 'time', final: 'exam', lightsOn: [], visitor: [70, 130], vendors: { gas: [20, 55] },
      dad: { mode: 'patrol', pace: 1.3, deskCheck: true, cmds: ['tea', 'water'], cmdEvery: [38, 52],
        plan: [tv(40, 55), look('kitchen', 3, 5), tv(35, 50), look('hallM', 3, 4)] },
      sibs: { chaos: [60, 90] },
      tasks: [
        talabat(),
        study(45),
        { id: 'exam', title: 'خلّي أبوك يوقّع الشهادة وهو رايق', sub: 'بعد كاسة شاي وهو قدام التلفزيون، أو عن طريق أمك', kind: 'chore', steps: [{ sign: true }] },
        secretPhone(20),
      ],
    }] },

  { id: 'thu', name: 'الخميس', title: 'الضيوف', intro: 'dad.intro.thu',
    blurb: 'دار عمك أبو فراس جايين. جهّز الصالون قبل ما يوصلوا، وبعدها قدّم القهوة: الكبير أول. أبوك ما بيقدر يصرخ قدامهم… بس بيسجّل، والحساب بعد ما يروحوا.',
    segs: [{
      tod: 'evening', time: 170, clock: [17 * 60, 18 * 60 + 30], end: 'tasks', lightsOn: ['kitchen'], visitor: [35, 65], title: 'قبل ما يوصلوا',
      finish: { spot: 'maindoor', title: 'كله جاهز! استنى الضيوف عند الباب', label: 'جاهز' },
      dad: { mode: 'patrol', pace: 1.5, cmds: ['water'], cmdEvery: [55, 75],
        plan: [look('salon', 6, 9), look('hallW', 2, 3), look('kitchen', 3, 5), look('living', 3, 4), look('salon', 5, 8), look('door', 3, 5)] },
      sibs: { chaos: [45, 70] },
      tasks: [
        carry('toys', 'ضب أغراضك من الصالون', 'toys', 'salontable', '@wardrobe'),
        carry('cups', 'حضّر فناجين الضيوف', 'cups', 'cups', 'salontable'),
        carry('kunafa', 'حط الكنافة عطاولة الصالون (وسكّر الثلاجة!)', 'kunafa', 'fridge', 'salontable'),
        use('dress', 'البس أواعي مرتبة', '@wardrobe', 3),
        { id: 'taste', title: 'ذوق الكنافة قبل الضيوف', kind: 'secret', needs: ['kunafa'], steps: [{ stay: 'salontable', secs: 6, act: 'eat', label: 'ذوق' }] },
      ],
    }, {
      tod: 'night', time: 150, clock: [19 * 60, 20 * 60 + 30], end: 'time', guests: true, lightsOn: ['salon', 'hall', 'kitchen'], title: 'الضيوف بالصالون',
      dad: { mode: 'seated', seat: 'salonS_1', plan: [] },
      sibs: { chaos: [40, 60] }, slipper: false,
      tasks: [
        { id: 'door', title: 'افتح الباب للضيوف', kind: 'chore', steps: [{ use: 'maindoor', secs: 1.2, label: 'افتح' }] },
        { id: 'coffee', title: 'قدّم القهوة: عمك، مرت عمك، بعدين أبوك', kind: 'chore', needs: ['door'], steps: [{ pick: 'coffee', at: 'kettle', secs: 3.5, label: 'صب القهوة' }, { give: 'coffee', to: 'uncle', keep: true }, { give: 'coffee', to: 'aunt', keep: true }, { give: 'coffee', to: 'dad' }] },
        { id: 'gwater', title: 'جيب مي لمرت عمك', kind: 'chore', needs: ['coffee'], steps: [{ pick: 'water', at: 'cooler', secs: 1.2 }, { give: 'water', to: 'aunt' }] },
        { id: 'polite', title: 'وقّف عند عمك وجاوبه بأدب', kind: 'chore', needs: ['door'], steps: [{ near: 'uncle', secs: 5, label: 'جاوب عمك' }] },
        secretPhone(15),
      ],
    }] },

  { id: 'fri', name: 'الجمعة', title: 'جمعة أبوي', intro: 'dad.intro.fri', boss: true,
    blurb: 'اليوم اللي كل الأسبوع كان تحضير إله. خمس مراحل: الصحيان، الصلاة، المنسف، قيلولة أبوك… وبعدها بيصحى ومزاجه مش رايق.',
    segs: [{
      tod: 'morning', time: 115, clock: [7 * 60, 9 * 60], end: 'tasks', startAsleep: true, lightsOn: [], visitor: [26, 40], title: 'الصبح: «الدنيا ظهر!»',
      dad: { mode: 'patrol', pace: 1.7, plan: [look('boys', 4, 6, { line: 'dad.fri.wake' }), look('hallE', 2, 3), look('yard', 6, 9), look('kitchen', 3, 4), look('sis', 3, 4, { line: 'dad.fri.wake' })] },
      sibs: { chaos: [50, 70] },
      tasks: [
        use('bed', 'رتّب تختك', '@bed', 3),
        { id: 'carwash', title: 'اغسل السيارة', kind: 'chore', steps: [{ use: 'tap', secs: 1.5, label: 'عبّي السطل' }, { use: 'car1', secs: 3, label: 'اغسل' }, { use: 'car2', secs: 3, label: 'اغسل' }, { use: 'car3', secs: 3, label: 'اغسل' }] },
        { id: 'sweep', title: 'كنّس الحوش', kind: 'chore', steps: [{ use: 'sweep1', secs: 1.8 }, { use: 'sweep2', secs: 1.8 }, { use: 'sweep3', secs: 1.8 }, { use: 'sweep4', secs: 1.8 }] },
        { id: 'sleep', title: 'نام 8 ثواني كمان', kind: 'secret', steps: [{ stay: '@bed', secs: 8, act: 'sleep', lie: true, label: 'نام' }] },
      ],
    }, {
      tod: 'day', time: 105, clock: [10 * 60 + 30, 11 * 60 + 45], end: 'tasks', bathBusy: 18, lightsOn: [], title: 'قبل الصلاة', vendors: { veg: [10, 24] },
      dad: { mode: 'patrol', pace: 1.4, plan: [tv(22, 30), look('hallM', 3, 4, { line: 'dad.fri.pray' }), { at: [14.6, 5.5], act: 'wait', dur: [400, 400], line: 'dad.fri.pray', face: [8, 5.5] }] },
      sibs: {},
      tasks: [
        use('shower', 'تحمّم', 'shower', 4.5, { only: ['big', 'kid'] }),
        use('dress', 'البس الأبيض للصلاة', '@wardrobe', 3, { only: ['big', 'kid'] }),
        { id: 'perfume', title: 'تعطّر من عطر أبوك (لا يشوفك)', kind: 'secret', only: ['big', 'kid'], steps: [{ use: 'nightstand', secs: 2.5, label: 'تعطّر', act: 'snoop' }] },
        { id: 'go', title: 'وقّف عند باب الدار جاهز', kind: 'chore', only: ['big', 'kid'], needs: ['shower', 'dress'], steps: [{ goto: 'maindoor', label: 'جاهز' }] },
        { id: 'chop', title: 'قطّعي السلطة مع أمك', kind: 'chore', only: ['sis'], steps: [{ use: 'counter', secs: 5, label: 'قطّعي', veg: 'salad' }] },
        carry('settable', 'حضّري الصحون عالطاولة', 'cups', 'cupboard', 'kitchentable', { only: ['sis'] }),
        carry('wetl', 'انشري الغسيل', 'wet', 'washer', 'clothesline', { only: ['sis'] }),
        secretPhone(15, ['sis']),
      ],
    }, {
      tod: 'day', time: 95, clock: [13 * 60 + 30, 14 * 60 + 30], end: 'tasks', lightsOn: ['kitchen'], title: 'المنسف', meal: true, finish: false,
      dad: { mode: 'patrol', plan: [{ at: [13.45, 8.55], act: 'wait', dur: [400, 400], line: 'dad.fri.lunch', face: [12.5, 8.5], turns: true }] },
      sibs: {}, slipper: false, sibsAt: 'table',
      tasks: [
        { id: 'mansaf', title: 'جيب سدر المنسف عالطاولة', kind: 'chore', steps: [{ pick: 'mansaf', at: 'stove', secs: 2, label: 'احمل السدر' }, { drop: 'mansaf', at: 'kitchentable', secs: 1.5 }] },
        { id: 'laban', title: 'جيب اللبن من الثلاجة', kind: 'chore', steps: [{ pick: 'laban', at: 'fridge', secs: 1.2 }, { drop: 'laban', at: 'kitchentable', secs: 1 }] },
        { id: 'eat', title: 'كُل منسف مع العيلة (بإيدك اليمين)', kind: 'chore', needs: ['mansaf', 'laban'], steps: [{ stay: 'kitchentable', secs: 12, act: 'meal', label: 'كُل' }] },
        { id: 'meat', title: 'اخطف قطعة لحمة زيادة وأبوك مش شايف', kind: 'secret', needs: ['mansaf'], steps: [{ stay: 'kitchentable', secs: 4, act: 'eat', label: 'اخطف', unseen: true }] },
      ],
    }, {
      tod: 'day', time: 105, clock: [15 * 60, 16 * 60 + 30], end: 'tasks', final: 'noWaste', lightsOn: [], title: 'قيلولة أبوك: ولا صوت',
      dad: { mode: 'nap', plan: [{ seat: 'bed_parents', act: 'nap', dur: [999, 999], line: 'dad.fri.nap' }] },
      sibs: { chaos: [14, 22] }, slipper: false,
      tasks: [
        use('dishes', 'اجلي صحون المنسف', 'kitchensink', 6),
        { id: 'steal', title: 'رجّع الريموت من خزانة أبوك وهو نايم', kind: 'chore', steps: [{ pick: 'remote', at: 'wardrobe_parents', secs: 4, label: 'فتّش بهدوء', act: 'snoop' }, { drop: 'remote', at: 'coffeetable', secs: 1 }] },
        secretPs(20), secretPhone(20, ['sis']),
      ],
    }, {
      tod: 'evening', time: 110, clock: [17 * 60, 18 * 60 + 40], end: 'time', lightsOn: ['living'], angerFloor: 52, title: 'صحي… ومزاجه مش رايق', finale: true,
      dad: { mode: 'patrol', pace: 1.6, cmds: ['tea', 'water', 'remote', 'glasses', 'paper', 'charger'], cmdEvery: [11, 16], maxCmds: 2,
        plan: [tv(10, 15, { line: 'dad.fri.evening' }), look('kitchen', 2, 3), look('hallM', 2, 3), tv(10, 14), look('boys', 3, 4), look('yard', 3, 4)] },
      sibs: { chaos: [20, 30] },
      tasks: [],
    }] },
];
