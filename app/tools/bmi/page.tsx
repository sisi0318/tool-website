"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Calculator, Info, RotateCcw } from "lucide-react"
import { calculateImperialBmi, calculateMetricBmi, clampFiniteNumber } from "@/lib/bmi-tools"

export default function BMICalculator() {
  const [activeTab, setActiveTab] = useState("metric")

  // 公制单位
  const [heightCm, setHeightCm] = useState(170)
  const [weightKg, setWeightKg] = useState(70)

  // 英制单位
  const [heightFt, setHeightFt] = useState(5)
  const [heightIn, setHeightIn] = useState(7)
  const [weightLbs, setWeightLbs] = useState(154)

  const bmi = activeTab === "metric"
    ? calculateMetricBmi(heightCm, weightKg)
    : calculateImperialBmi(heightFt, heightIn, weightLbs)

  // BMI分类和颜色
  let category = ""
  let color = ""
  let categoryDesc = ""

  if (bmi < 18.5) {
    category = "体重过轻"
    color = "text-blue-500"
    categoryDesc = "可能需要适当增重"
  } else if (bmi >= 18.5 && bmi < 25) {
    category = "正常体重"
    color = "text-green-500"
    categoryDesc = "保持良好的生活习惯"
  } else if (bmi >= 25 && bmi < 30) {
    category = "超重"
    color = "text-yellow-500"
    categoryDesc = "建议适当控制体重"
  } else if (bmi >= 30 && bmi < 35) {
    category = "肥胖 I 级"
    color = "text-orange-500"
    categoryDesc = "需要减重以降低健康风险"
  } else if (bmi >= 35 && bmi < 40) {
    category = "肥胖 II 级"
    color = "text-red-500"
    categoryDesc = "强烈建议寻求专业指导"
  } else {
    category = "肥胖 III 级"
    color = "text-red-700"
    categoryDesc = "需要立即寻求医疗帮助"
  }

  // 输入验证处理
  const handleHeightCmChange = (value: number) => {
    const validValue = clampFiniteNumber(value, 100, 250, heightCm)
    setHeightCm(validValue)
  }

  const handleWeightKgChange = (value: number) => {
    const validValue = clampFiniteNumber(value, 30, 300, weightKg)
    setWeightKg(validValue)
  }

  const handleHeightFtChange = (value: number) => {
    const validValue = clampFiniteNumber(value, 3, 8, heightFt)
    setHeightFt(validValue)
  }

  const handleHeightInChange = (value: number) => {
    const validValue = clampFiniteNumber(value, 0, 11, heightIn)
    setHeightIn(validValue)
  }

  const handleWeightLbsChange = (value: number) => {
    const validValue = clampFiniteNumber(value, 66, 660, weightLbs)
    setWeightLbs(validValue)
  }

  const resetValues = () => {
    setActiveTab("metric")
    setHeightCm(170)
    setWeightKg(70)
    setHeightFt(5)
    setHeightIn(7)
    setWeightLbs(154)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          <Calculator className="h-8 w-8" />
          BMI 计算器
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)]">
          计算您的身体质量指数 (Body Mass Index)
        </p>
      </div>

      {/* 免责声明 */}
      <Alert className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          <strong>免责声明：</strong>
          BMI仅为健康筛查工具，不能作为疾病诊断依据。它不能区分肌肉和脂肪重量，也不适用于孕妇、儿童、老年人或运动员。
          如有健康问题，请咨询专业医疗人员。
        </AlertDescription>
      </Alert>

      <Card className="card-elevated mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>身体数据输入</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetValues}>
            <RotateCcw className="mr-2 h-4 w-4" />
            恢复默认值
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="metric">公制 (cm/kg)</TabsTrigger>
              <TabsTrigger value="imperial">英制 (ft/lbs)</TabsTrigger>
            </TabsList>

            <TabsContent value="metric" className="space-y-6">
              <div className="space-y-4">
                {/* 身高 - 公制 */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="height-cm">身高 (cm)</Label>
                    <span className="font-medium">{heightCm} cm</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="height-cm"
                      min={100}
                      max={250}
                      step={1}
                      value={[heightCm]}
                      onValueChange={(value) => handleHeightCmChange(value[0])}
                      className="flex-1"
                    />
                    <Input
                      aria-label="身高（厘米）"
                      type="number"
                      value={heightCm}
                      onChange={(e) => {
                        handleHeightCmChange(e.currentTarget.valueAsNumber)
                      }}
                      className="w-24"
                      min={100}
                      max={250}
                    />
                  </div>
                </div>

                {/* 体重 - 公制 */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="weight-kg">体重 (kg)</Label>
                    <span className="font-medium">{weightKg} kg</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="weight-kg"
                      min={30}
                      max={300}
                      step={0.5}
                      value={[weightKg]}
                      onValueChange={(value) => handleWeightKgChange(value[0])}
                      className="flex-1"
                    />
                    <Input
                      aria-label="体重（千克）"
                      type="number"
                      value={weightKg}
                      onChange={(e) => {
                        handleWeightKgChange(e.currentTarget.valueAsNumber)
                      }}
                      className="w-24"
                      min={30}
                      max={300}
                      step={0.5}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="imperial" className="space-y-6">
              <div className="space-y-4">
                {/* 身高 - 英制 */}
                <div>
                  <Label className="block mb-2">身高</Label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">英尺</span>
                        <span className="font-medium">{heightFt} ft</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          aria-label="身高（英尺）"
                          min={3}
                          max={8}
                          step={1}
                          value={[heightFt]}
                          onValueChange={(value) => handleHeightFtChange(value[0])}
                          className="flex-1"
                        />
                        <Input
                          aria-label="身高（英尺）"
                          type="number"
                          value={heightFt}
                          onChange={(e) => {
                            handleHeightFtChange(e.currentTarget.valueAsNumber)
                          }}
                          className="w-20"
                          min={3}
                          max={8}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">英寸</span>
                        <span className="font-medium">{heightIn} in</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          aria-label="身高（英寸）"
                          min={0}
                          max={11}
                          step={1}
                          value={[heightIn]}
                          onValueChange={(value) => handleHeightInChange(value[0])}
                          className="flex-1"
                        />
                        <Input
                          aria-label="身高（英寸）"
                          type="number"
                          value={heightIn}
                          onChange={(e) => {
                            handleHeightInChange(e.currentTarget.valueAsNumber)
                          }}
                          className="w-20"
                          min={0}
                          max={11}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 体重 - 英制 */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="weight-lbs">体重 (lbs)</Label>
                    <span className="font-medium">{weightLbs} lbs</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="weight-lbs"
                      min={66}
                      max={660}
                      step={1}
                      value={[weightLbs]}
                      onValueChange={(value) => handleWeightLbsChange(value[0])}
                      className="flex-1"
                    />
                    <Input
                      aria-label="体重（磅）"
                      type="number"
                      value={weightLbs}
                      onChange={(e) => {
                        handleWeightLbsChange(e.currentTarget.valueAsNumber)
                      }}
                      className="w-24"
                      min={66}
                      max={660}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* BMI 结果 */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>BMI 计算结果</CardTitle>
        </CardHeader>
        <CardContent>
          {/* BMI 数值显示 */}
          <div className="text-center mb-6">
            <div className="text-5xl font-bold mb-2">{bmi}</div>
            <div className={`text-xl font-medium ${color} mb-1`}>{category}</div>
            <div className="text-gray-600 dark:text-gray-400">{categoryDesc}</div>
          </div>

          {/* BMI 量表 */}
          <div className="mb-6">
            <div className="relative h-8 rounded-full overflow-hidden flex mb-3">
              <div className="bg-blue-500 flex-1" title="体重过轻 (< 18.5)"></div>
              <div className="bg-green-500 flex-1" title="正常体重 (18.5-24.9)"></div>
              <div className="bg-yellow-500 flex-1" title="超重 (25-29.9)"></div>
              <div className="bg-orange-500 flex-1" title="肥胖 I 级 (30-34.9)"></div>
              <div className="bg-red-500 flex-1" title="肥胖 II 级 (35-39.9)"></div>
              <div className="bg-red-700 flex-1" title="肥胖 III 级 (≥ 40)"></div>

              {/* BMI 指示器 */}
              {bmi > 0 && (
                <div
                  className="absolute top-0 w-2 h-8 bg-white border-2 border-gray-800 dark:border-white rounded-sm"
                  style={{
                    left: `${Math.min(Math.max(((bmi - 15) / 35) * 100, 0), 100)}%`,
                    transform: "translateX(-50%)",
                  }}
                ></div>
              )}
            </div>

            <div className="flex text-xs justify-between text-gray-500 px-1">
              <span>15</span>
              <span>18.5</span>
              <span>25</span>
              <span>30</span>
              <span>35</span>
              <span>40</span>
              <span>50</span>
            </div>
          </div>

          {/* BMI 分类说明 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="w-4 h-4 rounded-full bg-blue-500 mr-3"></div>
              <div>
                <div className="font-medium text-sm">体重过轻</div>
                <div className="text-xs text-gray-500">&lt; 18.5</div>
              </div>
            </div>
            <div className="flex items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-3"></div>
              <div>
                <div className="font-medium text-sm">正常体重</div>
                <div className="text-xs text-gray-500">18.5 - 24.9</div>
              </div>
            </div>
            <div className="flex items-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
              <div className="w-4 h-4 rounded-full bg-yellow-500 mr-3"></div>
              <div>
                <div className="font-medium text-sm">超重</div>
                <div className="text-xs text-gray-500">25.0 - 29.9</div>
              </div>
            </div>
            <div className="flex items-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <div className="w-4 h-4 rounded-full bg-orange-500 mr-3"></div>
              <div>
                <div className="font-medium text-sm">肥胖 I 级</div>
                <div className="text-xs text-gray-500">30.0 - 34.9</div>
              </div>
            </div>
            <div className="flex items-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="w-4 h-4 rounded-full bg-red-500 mr-3"></div>
              <div>
                <div className="font-medium text-sm">肥胖 II 级</div>
                <div className="text-xs text-gray-500">35.0 - 39.9</div>
              </div>
            </div>
            <div className="flex items-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="w-4 h-4 rounded-full bg-red-700 mr-3"></div>
              <div>
                <div className="font-medium text-sm">肥胖 III 级</div>
                <div className="text-xs text-gray-500">≥ 40.0</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 注意事项 */}
      <Alert className="mt-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <div className="space-y-2">
            <div><strong>使用说明：</strong></div>
            <ul className="text-sm space-y-1 ml-4">
              <li>• BMI = 体重(kg) ÷ 身高²(m²)</li>
              <li>• 此计算器适用于18-65岁健康成年人</li>
              <li>• 不适用于：孕妇、哺乳期妇女、儿童、运动员、老年人</li>
              <li>• BMI不能反映体脂肪分布情况</li>
              <li>• 如有健康疑问，请咨询医疗专业人士</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
