/** 「temperatureConverter」的中文文案：只随用到它的页面加载，调用处写 useTranslations("temperatureConverter", zhTemperatureConverter) */
export const zhTemperatureConverter = {
  title: "温度转换器",
  description: "开尔文、摄氏度、华氏度、兰金、德莱尔、牛顿、雷奥穆尔和罗默温度度数转换。",
  copy: "复制",
  copied: "已复制",
  copyFailed: "复制失败",
  decrease: "减少",
  increase: "增加",
  settings: "温度设置",
  clickToView: "点击查看",
  autoFormat: "自动格式化数值",
  showDescriptions: "显示单位说明",
  compactDisplay: "使用紧凑卡片",
  precision: "小数精度",
  decimalPlaces: "位",
  categories: {
    common: { title: "常用温度单位", badge: "日常使用" },
    scientific: { title: "科学温度单位", badge: "科学研究" },
    historical: { title: "历史温度单位", badge: "历史参考" },
  },
  presetsTitle: "常见温度预设",
  clickToSet: "点击快速设置",
  scales: {
    kelvin: {
      name: "开尔文",
      description: "热力学温标的基本单位，以绝对零度为起点。",
    },
    celsius: {
      name: "摄氏度",
      description: "最常用的温度单位之一，水在标准气压下 0 °C 结冰、100 °C 沸腾。",
    },
    fahrenheit: {
      name: "华氏度",
      description: "美国日常使用的温度单位，水的冰点为 32 °F。",
    },
    rankine: {
      name: "兰金",
      description: "以华氏度大小为刻度的绝对温标，常见于工程热力学。",
    },
    delisle: {
      name: "德莱尔",
      description: "约瑟夫-尼古拉·德莱尔提出的历史温标，数值随温度升高而降低。",
    },
    newton: {
      name: "牛顿",
      description: "艾萨克·牛顿提出的历史温标。",
    },
    reaumur: {
      name: "雷奥穆尔",
      description: "法国科学家勒内·安托万·费尔绍·德·雷奥穆尔提出的历史温标。",
    },
    romer: {
      name: "罗默",
      description: "丹麦天文学家奥勒·罗默提出的历史温标。",
    },
  },
  presets: {
    absoluteZero: "绝对零度",
    liquidNitrogen: "液氮沸点",
    dryIce: "干冰升华点",
    waterFreezing: "水的冰点",
    roomTemperature: "室温",
    bodyTemperature: "人体体温",
    waterBoiling: "水的沸点",
    bakingTemperature: "常用烘焙温度",
    sunSurface: "太阳表面",
    earthCore: "地球核心",
  },
}
