"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Check, ArrowRight, Plus, Trash2, RefreshCw, AlertCircle, Info, Zap, Settings } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DockerConverterProps {
  params?: Record<string, string>
}

// 定义配置项接口
interface ConfigItem {
  id: string
  type: "port" | "volume" | "env" | "label" | "restart" | "network" | "memory" | "cpu" | 
        "healthcheck" | "depends_on" | "build" | "workdir" | "user" | "command" | "entrypoint" |
        "privileged" | "cap_add" | "cap_drop" | "tmpfs" | "shm_size" | "ulimit" | "log_driver"
  value: string
  hostValue?: string // 用于端口映射和卷挂载的主机部分
  additionalValue?: string // 用于某些需要多个值的配置项
  options?: string[] // 用于存储多个选项
}

// Docker 服务配置接口
interface DockerService {
  image?: string
  container_name?: string
  ports?: string[]
  volumes?: string[]
  environment?: string[]
  labels?: string[]
  restart?: string
  networks?: string[]
  network_mode?: string
  working_dir?: string
  user?: string
  command?: string
  entrypoint?: string
  healthcheck?: {
    test?: string[]
    interval?: string
    timeout?: string
    retries?: number
    start_period?: string
  }
  depends_on?: string[]
  build?: {
    context?: string
    dockerfile?: string
    args?: string[]
  }
  mem_limit?: string
  mem_reservation?: string
  cpus?: string
  privileged?: boolean
  cap_add?: string[]
  cap_drop?: string[]
  tmpfs?: string[]
  shm_size?: string
  ulimits?: any
  logging?: {
    driver?: string
    options?: Record<string, string>
  }
}

// 解析结果接口
interface ParseResult {
  services: Record<string, DockerService>
  networks?: Record<string, any>
  volumes?: Record<string, any>
  errors: string[]
  warnings: string[]
}

export default function DockerConverterPage({ params }: DockerConverterProps) {
  const t = useTranslations("dockerConverter")
  const [dockerRunCommand, setDockerRunCommand] = useState("")
  const [dockerComposeYaml, setDockerComposeYaml] = useState("")
  const [copied, setCopied] = useState(false)
  const yamlRef = useRef<HTMLDivElement>(null)

  // 自定义配置项状态
  const [imageName, setImageName] = useState("nginx")
  const [containerName, setContainerName] = useState("")
  const [configItems, setConfigItems] = useState<ConfigItem[]>([])
  const [generatedDockerRun, setGeneratedDockerRun] = useState("")
  const [generatedDockerCompose, setGeneratedDockerCompose] = useState("")
  const [copiedGenerated, setCopiedGenerated] = useState(false)

  // 新增状态
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [autoConvert, setAutoConvert] = useState(false)
  const [composeVersion, setComposeVersion] = useState("3.9")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isParsingCommand, setIsParsingCommand] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // 切换展开状态
  const toggleExpanded = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }

  // 改进的命令行解析函数
  const parseDockerRunCommand = (command: string): ParseResult => {
    const result: ParseResult = {
      services: {},
      errors: [],
      warnings: []
    }

    try {
      // 清理并标准化命令
      const cleanCommand = command.trim().replace(/\\\s*\n\s*/g, ' ').replace(/\s+/g, ' ')
      
      if (!cleanCommand.startsWith('docker run')) {
        result.errors.push('命令必须以 "docker run" 开头')
        return result
      }

      // 提取命令部分
      const commandPart = cleanCommand.substring(10).trim() // 移除 "docker run"
      
      // 使用更智能的参数解析
      const args = parseCommandArgs(commandPart)
      
      if (args.length === 0) {
        result.errors.push('未找到有效的参数或镜像名')
        return result
      }

      // 初始化服务配置
      let serviceName = 'app'
      let imageFound = false
      const service: DockerService = {}

      // 解析参数
      for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        // 如果不是选项且镜像未找到，则认为是镜像名
        if (!arg.startsWith('-') && !imageFound) {
          service.image = arg
          imageFound = true
          // 从镜像名推导服务名
          const imageParts = arg.split('/')
          const imageName = imageParts[imageParts.length - 1]
          serviceName = imageName.split(':')[0].replace(/[^a-zA-Z0-9_-]/g, '_')
          continue
        }

        // 解析各种 Docker 选项
        switch (arg) {
          case '--name':
            if (i + 1 < args.length) {
              serviceName = args[++i].replace(/[^a-zA-Z0-9_-]/g, '_')
              service.container_name = args[i]
            } else {
              result.errors.push('--name 参数需要一个值')
            }
            break

          case '-p':
          case '--publish':
            if (i + 1 < args.length) {
              if (!service.ports) service.ports = []
              service.ports.push(args[++i])
            } else {
              result.errors.push('-p/--publish 参数需要一个值')
            }
            break

          case '-v':
          case '--volume':
          case '--mount':
            if (i + 1 < args.length) {
              if (!service.volumes) service.volumes = []
              service.volumes.push(args[++i])
            } else {
              result.errors.push('-v/--volume 参数需要一个值')
            }
            break

          case '-e':
          case '--env':
            if (i + 1 < args.length) {
              if (!service.environment) service.environment = []
              service.environment.push(args[++i])
            } else {
              result.errors.push('-e/--env 参数需要一个值')
            }
            break

          case '--env-file':
            if (i + 1 < args.length) {
              i++ // 跳过文件名
              result.warnings.push('env-file 不能直接转换，需要手动处理环境变量文件')
            }
            break

          case '-l':
          case '--label':
            if (i + 1 < args.length) {
              if (!service.labels) service.labels = []
              service.labels.push(args[++i])
            } else {
              result.errors.push('-l/--label 参数需要一个值')
            }
            break

          case '--restart':
            if (i + 1 < args.length) {
              service.restart = args[++i]
            } else {
              result.errors.push('--restart 参数需要一个值')
            }
            break

          case '--network':
            if (i + 1 < args.length) {
              const network = args[++i]
              if (network === 'host' || network === 'none' || network === 'bridge') {
                service.network_mode = network
              } else {
                if (!service.networks) service.networks = []
                service.networks.push(network)
              }
            }
            break

          case '-w':
          case '--workdir':
            if (i + 1 < args.length) {
              service.working_dir = args[++i]
            }
            break

          case '-u':
          case '--user':
            if (i + 1 < args.length) {
              service.user = args[++i]
            }
            break

          case '--privileged':
            service.privileged = true
            break

          case '--cap-add':
            if (i + 1 < args.length) {
              if (!service.cap_add) service.cap_add = []
              service.cap_add.push(args[++i])
            }
            break

          case '--cap-drop':
            if (i + 1 < args.length) {
              if (!service.cap_drop) service.cap_drop = []
              service.cap_drop.push(args[++i])
            }
            break

          case '-m':
          case '--memory':
            if (i + 1 < args.length) {
              service.mem_limit = args[++i]
            }
            break

          case '--memory-reservation':
            if (i + 1 < args.length) {
              service.mem_reservation = args[++i]
            }
            break

          case '--cpus':
            if (i + 1 < args.length) {
              service.cpus = args[++i]
            }
            break

          case '--shm-size':
            if (i + 1 < args.length) {
              service.shm_size = args[++i]
            }
            break

          case '--tmpfs':
            if (i + 1 < args.length) {
              if (!service.tmpfs) service.tmpfs = []
              service.tmpfs.push(args[++i])
            }
            break

          case '--health-cmd':
            if (i + 1 < args.length) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.test = ['CMD-SHELL', args[++i]]
            }
            break

          case '--health-interval':
            if (i + 1 < args.length) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.interval = args[++i]
            }
            break

          case '--health-timeout':
            if (i + 1 < args.length) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.timeout = args[++i]
            }
            break

          case '--health-retries':
            if (i + 1 < args.length) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.retries = parseInt(args[++i])
            }
            break

          case '--entrypoint':
            if (i + 1 < args.length) {
              service.entrypoint = args[++i]
            }
            break

          case '--log-driver':
            if (i + 1 < args.length) {
              if (!service.logging) service.logging = {}
              service.logging.driver = args[++i]
            }
            break

          case '--log-opt':
            if (i + 1 < args.length) {
              if (!service.logging) service.logging = { options: {} }
              if (!service.logging.options) service.logging.options = {}
              
              const logOpt = args[++i]
              const [key, value] = logOpt.split('=', 2)
              if (key && value) {
                service.logging.options[key] = value
              }
            }
            break

          case '-d':
          case '--detach':
            // Docker Compose 默认后台运行
            break

          case '-it':
          case '-i':
          case '--interactive':
          case '-t':
          case '--tty':
            result.warnings.push('交互式选项 (-it) 在 docker-compose 中需要使用 stdin_open 和 tty 配置')
            break

          case '--rm':
            result.warnings.push('--rm 选项在 docker-compose 中不适用')
            break

          default:
            // 处理连接的参数形式（如 -p80:80, --shm-size=256m）
            if (arg.startsWith('-p') && arg.length > 2) {
              if (!service.ports) service.ports = []
              service.ports.push(arg.substring(2))
            } else if (arg.startsWith('-v') && arg.length > 2) {
              if (!service.volumes) service.volumes = []
              service.volumes.push(arg.substring(2))
            } else if (arg.startsWith('-e') && arg.length > 2) {
              if (!service.environment) service.environment = []
              service.environment.push(arg.substring(2))
            } else if (arg.startsWith('--shm-size=')) {
              service.shm_size = arg.substring(12) // 移除 '--shm-size='
            } else if (arg.startsWith('--memory=') || arg.startsWith('-m=')) {
              service.mem_limit = arg.includes('=') ? arg.split('=')[1] : arg
            } else if (arg.startsWith('--cpus=')) {
              service.cpus = arg.substring(7) // 移除 '--cpus='
            } else if (arg.startsWith('--user=') || arg.startsWith('-u=')) {
              service.user = arg.includes('=') ? arg.split('=')[1] : arg
            } else if (arg.startsWith('--workdir=') || arg.startsWith('-w=')) {
              service.working_dir = arg.includes('=') ? arg.split('=')[1] : arg
            } else if (arg.startsWith('--name=')) {
              const name = arg.substring(7)
              serviceName = name.replace(/[^a-zA-Z0-9_-]/g, '_')
              service.container_name = name
            } else if (arg.startsWith('--restart=')) {
              service.restart = arg.substring(10)
            } else if (arg.startsWith('--network=')) {
              const network = arg.substring(10)
              if (network === 'host' || network === 'none' || network === 'bridge') {
                service.network_mode = network
              } else {
                if (!service.networks) service.networks = []
                service.networks.push(network)
              }
            } else if (arg.startsWith('--cap-add=')) {
              if (!service.cap_add) service.cap_add = []
              service.cap_add.push(arg.substring(10))
            } else if (arg.startsWith('--cap-drop=')) {
              if (!service.cap_drop) service.cap_drop = []
              service.cap_drop.push(arg.substring(11))
            } else if (arg.startsWith('--tmpfs=')) {
              if (!service.tmpfs) service.tmpfs = []
              service.tmpfs.push(arg.substring(8))
            } else if (arg.startsWith('--log-driver=')) {
              if (!service.logging) service.logging = {}
              service.logging.driver = arg.substring(13)
            } else if (arg.startsWith('--health-cmd=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.test = ['CMD-SHELL', arg.substring(13)]
            } else if (arg.startsWith('--health-interval=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.interval = arg.substring(18)
            } else if (arg.startsWith('--health-timeout=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.timeout = arg.substring(17)
            } else if (arg.startsWith('--health-retries=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.retries = parseInt(arg.substring(17))
            } else if (arg.startsWith('--health-start-period=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.start_period = arg.substring(22)
            } else if (arg.startsWith('--entrypoint=')) {
              service.entrypoint = arg.substring(13)
            } else if (arg.startsWith('--memory-reservation=')) {
              service.mem_reservation = arg.substring(21)
            } else if (arg.startsWith('-') && !imageFound) {
              result.warnings.push(`未识别的选项: ${arg}`)
            } else if (!arg.startsWith('-') && imageFound) {
              // 可能是命令参数
              if (!service.command) {
                service.command = arg
              } else {
                service.command += ' ' + arg
              }
            }
            break
        }
      }

      if (!imageFound) {
        result.errors.push('未找到镜像名称')
        return result
      }

      result.services[serviceName] = service

    } catch (error) {
      result.errors.push(`解析错误: ${(error as Error).message}`)
    }

    return result
  }

  // 解析命令行参数（支持引号）
  const parseCommandArgs = (command: string): string[] => {
    const args: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''
    let escaping = false

    for (let i = 0; i < command.length; i++) {
      const char = command[i]

      if (escaping) {
        current += char
        escaping = false
        continue
      }

      if (char === '\\') {
        escaping = true
        continue
      }

      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false
          quoteChar = ''
        } else {
          current += char
        }
      } else {
        if (char === '"' || char === "'") {
          inQuotes = true
          quoteChar = char
        } else if (char === ' ' && current.length > 0) {
          args.push(current)
          current = ''
        } else if (char !== ' ') {
          current += char
        }
      }
    }

    if (current.length > 0) {
      args.push(current)
    }

    return args
  }

  const convertToDockerCompose = () => {
    if (!dockerRunCommand.trim()) {
      setParseResult(null)
      setDockerComposeYaml("")
      setValidationErrors([])
      return
    }

    setIsParsingCommand(true)
    
    try {
      // 使用新的解析函数
      const result = parseDockerRunCommand(dockerRunCommand)
      setParseResult(result)
      
      if (result.errors.length > 0) {
        setValidationErrors(result.errors)
        setDockerComposeYaml("")
        return
      }

      // 生成 YAML
      const yaml = generateDockerComposeYaml(result, composeVersion)
      setDockerComposeYaml(yaml)
      setValidationErrors([])

    } catch (error) {
      console.error("转换错误:", error)
      const errorMessage = `转换失败: ${(error as Error).message}`
      setDockerComposeYaml(errorMessage)
      setValidationErrors([errorMessage])
    } finally {
      setIsParsingCommand(false)
    }
  }

  // 生成 Docker Compose YAML
  const generateDockerComposeYaml = (result: ParseResult, version: string): string => {
    let yaml = `version: '${version}'\n\n`
    
    // 检查是否需要定义网络
    const customNetworks = new Set<string>()
    Object.values(result.services).forEach(service => {
      if (service.networks) {
        service.networks.forEach(network => {
          if (network !== 'default' && network !== 'bridge' && network !== 'host' && network !== 'none') {
            customNetworks.add(network)
          }
        })
      }
    })

    yaml += "services:\n"
    
    Object.entries(result.services).forEach(([serviceName, service]) => {
      yaml += `  ${serviceName}:\n`
      
      // 镜像
      if (service.image) {
        yaml += `    image: ${service.image}\n`
      }
      
      // 容器名称
      if (service.container_name) {
        yaml += `    container_name: ${service.container_name}\n`
      }
      
      // 端口映射
      if (service.ports && service.ports.length > 0) {
        yaml += "    ports:\n"
        service.ports.forEach(port => {
          yaml += `      - "${port}"\n`
        })
      }
      
      // 卷挂载
      if (service.volumes && service.volumes.length > 0) {
        yaml += "    volumes:\n"
        service.volumes.forEach(volume => {
          yaml += `      - "${volume}"\n`
        })
      }
      
      // 环境变量
      if (service.environment && service.environment.length > 0) {
        yaml += "    environment:\n"
        service.environment.forEach(env => {
          if (env.includes('=')) {
            const [key, ...values] = env.split('=')
            yaml += `      ${key}: "${values.join('=')}"\n`
          } else {
            yaml += `      - "${env}"\n`
          }
        })
      }
      
      // 标签
      if (service.labels && service.labels.length > 0) {
        yaml += "    labels:\n"
        service.labels.forEach(label => {
          if (label.includes('=')) {
            const [key, ...values] = label.split('=')
            yaml += `      ${key}: "${values.join('=')}"\n`
          } else {
            yaml += `      - "${label}"\n`
          }
        })
      }
      
      // 重启策略
      if (service.restart) {
        yaml += `    restart: ${service.restart}\n`
      }
      
      // 网络配置
      if (service.network_mode) {
        yaml += `    network_mode: ${service.network_mode}\n`
      } else if (service.networks && service.networks.length > 0) {
        yaml += "    networks:\n"
        service.networks.forEach(network => {
          yaml += `      - ${network}\n`
        })
      }
      
      // 工作目录
      if (service.working_dir) {
        yaml += `    working_dir: ${service.working_dir}\n`
      }
      
      // 用户
      if (service.user) {
        yaml += `    user: ${service.user}\n`
      }
      
      // 命令
      if (service.command) {
        yaml += `    command: ${service.command}\n`
      }
      
      // 入口点
      if (service.entrypoint) {
        yaml += `    entrypoint: ${service.entrypoint}\n`
      }
      
      // 特权模式
      if (service.privileged) {
        yaml += `    privileged: true\n`
      }
      
      // 能力添加
      if (service.cap_add && service.cap_add.length > 0) {
        yaml += "    cap_add:\n"
        service.cap_add.forEach(cap => {
          yaml += `      - ${cap}\n`
        })
      }
      
      // 能力删除
      if (service.cap_drop && service.cap_drop.length > 0) {
        yaml += "    cap_drop:\n"
        service.cap_drop.forEach(cap => {
          yaml += `      - ${cap}\n`
        })
      }
      
      // 临时文件系统
      if (service.tmpfs && service.tmpfs.length > 0) {
        yaml += "    tmpfs:\n"
        service.tmpfs.forEach(tmpfs => {
          yaml += `      - ${tmpfs}\n`
        })
      }
      
      // 共享内存大小
      if (service.shm_size) {
        yaml += `    shm_size: ${service.shm_size}\n`
      }
      
      // 资源限制
      const limits: string[] = []
      if (service.mem_limit) limits.push(`      memory: ${service.mem_limit}`)
      if (service.mem_reservation) limits.push(`      memory_reservation: ${service.mem_reservation}`)
      if (service.cpus) limits.push(`      cpus: '${service.cpus}'`)
      
      if (limits.length > 0) {
        yaml += "    deploy:\n"
        yaml += "      resources:\n"
        yaml += "        limits:\n"
        yaml += limits.join('\n') + '\n'
      }
      
      // 健康检查
      if (service.healthcheck) {
        yaml += "    healthcheck:\n"
        if (service.healthcheck.test) {
          yaml += `      test: [${service.healthcheck.test.map(t => `"${t}"`).join(', ')}]\n`
        }
        if (service.healthcheck.interval) {
          yaml += `      interval: ${service.healthcheck.interval}\n`
        }
        if (service.healthcheck.timeout) {
          yaml += `      timeout: ${service.healthcheck.timeout}\n`
        }
        if (service.healthcheck.retries) {
          yaml += `      retries: ${service.healthcheck.retries}\n`
        }
        if (service.healthcheck.start_period) {
          yaml += `      start_period: ${service.healthcheck.start_period}\n`
        }
      }
      
      // 日志配置
      if (service.logging) {
        yaml += "    logging:\n"
        if (service.logging.driver) {
          yaml += `      driver: ${service.logging.driver}\n`
        }
        if (service.logging.options && Object.keys(service.logging.options).length > 0) {
          yaml += "      options:\n"
          Object.entries(service.logging.options).forEach(([key, value]) => {
            yaml += `        ${key}: "${value}"\n`
          })
        }
      }
      
      yaml += "\n"
    })
    
    // 添加自定义网络定义
    if (customNetworks.size > 0) {
      yaml += "networks:\n"
      customNetworks.forEach(network => {
        yaml += `  ${network}:\n`
        yaml += `    external: true\n`
      })
    }
    
    return yaml.trim()
  }

  const copyToClipboard = (text: string, setCopiedState: (copied: boolean) => void) => {
    if (text) {
      navigator.clipboard.writeText(text)
      setCopiedState(true)
      setTimeout(() => setCopiedState(false), 2000)
    }
  }

  // 自动转换监听
  useEffect(() => {
    if (autoConvert && dockerRunCommand.trim()) {
      const timer = setTimeout(() => {
        convertToDockerCompose()
      }, 500) // 500ms 延迟避免频繁转换
      
      return () => clearTimeout(timer)
    }
  }, [dockerRunCommand, autoConvert])

  const handleExampleClick = (example: string) => {
    setDockerRunCommand(example)
    if (!autoConvert) {
      setTimeout(() => {
        convertToDockerCompose()
      }, 100)
    }
  }

  // 示例命令
  const examples = [
    {
      name: "Nginx 服务器",
      command: "docker run --name nginx-server -p 80:80 -p 443:443 -v /var/www/html:/usr/share/nginx/html:ro -v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro --restart unless-stopped nginx:latest"
    },
    {
      name: "MySQL 数据库",
      command: "docker run --name mysql-db -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=myapp -e MYSQL_USER=appuser -e MYSQL_PASSWORD=apppass -p 3306:3306 -v mysql-data:/var/lib/mysql --restart always mysql:8.0"
    },
    {
      name: "Redis 缓存",
      command: "docker run --name redis-cache -p 6379:6379 -v redis-data:/data --restart always --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 redis:alpine redis-server --appendonly yes"
    },
    {
      name: "Node.js 应用",
      command: 'docker run --name node-app -p 3000:3000 -e NODE_ENV=production -e PORT=3000 -v /app/uploads:/app/uploads -w /app --user 1000:1000 --memory=512m --cpus=0.5 --health-cmd="curl -f http://localhost:3000/health || exit 1" --health-interval=30s --health-timeout=3s --health-retries=3 node:18-alpine npm start'
    },
    {
      name: "PostgreSQL 数据库",
      command: "docker run --name postgres-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=myapp -e POSTGRES_USER=appuser -p 5432:5432 -v postgres-data:/var/lib/postgresql/data --restart always --shm-size=256m postgres:15-alpine"
    },
    {
      name: "复杂应用示例",
      command: 'docker run --name complex-app -p 8080:8080 -p 8443:8443 -e APP_ENV=production -e DATABASE_URL="postgres://user:pass@db:5432/app" -v /app/logs:/var/log/app -v /app/uploads:/var/uploads --network=app-network --restart=unless-stopped --memory=1g --cpus=1.0 --cap-add=NET_ADMIN --cap-drop=ALL --tmpfs /tmp:rw,size=100m --log-driver=fluentd --log-opt fluentd-address=localhost:24224 --log-opt tag=app.{{.Name}} --health-cmd="curl -f http://localhost:8080/api/health" --health-interval=30s --health-timeout=10s --health-retries=3 --health-start-period=60s myapp:latest'
    }
  ]

  // 添加配置项
  const addConfigItem = (type: ConfigItem["type"]) => {
    const newItem: ConfigItem = {
      id: Date.now().toString(),
      type,
      value: "",
      hostValue: type === "port" || type === "volume" ? "" : undefined,
    }
    setConfigItems([...configItems, newItem])
  }

  // 删除配置项
  const removeConfigItem = (id: string) => {
    setConfigItems(configItems.filter((item) => item.id !== id))
  }

  // 更新配置项
  const updateConfigItem = (id: string, field: "value" | "hostValue", value: string) => {
    setConfigItems(configItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  // 生成docker run命令和docker-compose文件
  const generateDockerCommands = () => {
    if (!imageName) return

    try {
      // 生成docker run命令
      let runCmd = "docker run"

      // 添加容器名称
      if (containerName) {
        runCmd += ` --name ${containerName}`
      }

      // 添加配置项
      configItems.forEach((item) => {
        switch (item.type) {
          case "port":
            if (item.hostValue && item.value) {
              runCmd += ` -p ${item.hostValue}:${item.value}`
            }
            break
          case "volume":
            if (item.hostValue && item.value) {
              runCmd += ` -v ${item.hostValue}:${item.value}`
            }
            break
          case "env":
            if (item.value) {
              runCmd += ` -e ${item.value}`
            }
            break
          case "label":
            if (item.value) {
              runCmd += ` -l ${item.value}`
            }
            break
          case "restart":
            if (item.value) {
              runCmd += ` --restart ${item.value}`
            }
            break
          case "network":
            if (item.value) {
              runCmd += ` --network ${item.value}`
            }
            break
          case "memory":
            if (item.value) {
              runCmd += ` -m ${item.value}`
            }
            break
          case "cpu":
            if (item.value) {
              runCmd += ` --cpus ${item.value}`
            }
            break
        }
      })

      // 添加镜像名称
      runCmd += ` ${imageName}`

      setGeneratedDockerRun(runCmd)

      // 生成docker-compose文件
      const serviceName = containerName || imageName.split("/").pop()?.split(":")[0] || "app"

      let composeYaml = "version: '3.9'\n"
      composeYaml += "services:\n"
      composeYaml += `  ${serviceName}:\n`
      composeYaml += `    image: ${imageName}\n`

      // 添加端口映射
      const ports = configItems.filter((item) => item.type === "port" && item.hostValue && item.value)
      if (ports.length > 0) {
        composeYaml += "    ports:\n"
        ports.forEach((port) => {
          composeYaml += `      - '${port.hostValue}:${port.value}'\n`
        })
      }

      // 添加卷挂载
      const volumes = configItems.filter((item) => item.type === "volume" && item.hostValue && item.value)
      if (volumes.length > 0) {
        composeYaml += "    volumes:\n"
        volumes.forEach((volume) => {
          composeYaml += `      - '${volume.hostValue}:${volume.value}'\n`
        })
      }

      // 添加环境变量
      const envs = configItems.filter((item) => item.type === "env" && item.value)
      if (envs.length > 0) {
        composeYaml += "    environment:\n"
        envs.forEach((env) => {
          composeYaml += `      - '${env.value}'\n`
        })
      }

      // 添加标签
      const labels = configItems.filter((item) => item.type === "label" && item.value)
      if (labels.length > 0) {
        composeYaml += "    labels:\n"
        labels.forEach((label) => {
          composeYaml += `      - '${label.value}'\n`
        })
      }

      // 添加重启策略
      const restartItem = configItems.find((item) => item.type === "restart")
      if (restartItem && restartItem.value) {
        composeYaml += `    restart: ${restartItem.value}\n`
      }

      // 添加网络模式
      const networkItem = configItems.find((item) => item.type === "network")
      if (networkItem && networkItem.value) {
        composeYaml += `    network_mode: ${networkItem.value}\n`
      }

      // 添加内存限制
      const memoryItem = configItems.find((item) => item.type === "memory")
      if (memoryItem && memoryItem.value) {
        composeYaml += `    mem_limit: ${memoryItem.value}\n`
      }

      // 添加CPU限制
      const cpuItem = configItems.find((item) => item.type === "cpu")
      if (cpuItem && cpuItem.value) {
        composeYaml += `    cpus: ${cpuItem.value}\n`
      }

      setGeneratedDockerCompose(composeYaml)
    } catch (error) {
      console.error("生成错误:", error)
      setGeneratedDockerRun(t("generationError") + ": " + (error as Error).message)
      setGeneratedDockerCompose(t("generationError") + ": " + (error as Error).message)
    }
  }

  // 渲染配置项输入表单
  const renderConfigItemInput = (item: ConfigItem) => {
    switch (item.type) {
      case "port":
        return (
          <div className="flex gap-2 items-center" key={item.id}>
            <Input
              value={item.hostValue || ""}
              onChange={(e) => updateConfigItem(item.id, "hostValue", e.target.value)}
              placeholder={t("hostPort")}
              className="w-1/3"
            />
            <ArrowRight className="h-4 w-4 flex-shrink-0" />
            <Input
              value={item.value}
              onChange={(e) => updateConfigItem(item.id, "value", e.target.value)}
              placeholder={t("containerPort")}
              className="w-1/3"
            />
            <Button variant="ghost" size="icon" onClick={() => removeConfigItem(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )

      case "volume":
        return (
          <div className="flex gap-2 items-center" key={item.id}>
            <Input
              value={item.hostValue || ""}
              onChange={(e) => updateConfigItem(item.id, "hostValue", e.target.value)}
              placeholder={t("hostPath")}
              className="w-1/3"
            />
            <ArrowRight className="h-4 w-4 flex-shrink-0" />
            <Input
              value={item.value}
              onChange={(e) => updateConfigItem(item.id, "value", e.target.value)}
              placeholder={t("containerPath")}
              className="w-1/3"
            />
            <Button variant="ghost" size="icon" onClick={() => removeConfigItem(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )

      case "restart":
        return (
          <div className="flex gap-2 items-center" key={item.id}>
            <Select value={item.value} onValueChange={(value) => updateConfigItem(item.id, "value", value)}>
              <SelectTrigger className="w-2/3">
                <SelectValue placeholder={t("selectRestartPolicy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">no</SelectItem>
                <SelectItem value="always">always</SelectItem>
                <SelectItem value="on-failure">on-failure</SelectItem>
                <SelectItem value="unless-stopped">unless-stopped</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => removeConfigItem(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )

      default:
        return (
          <div className="flex gap-2 items-center" key={item.id}>
            <Input
              value={item.value}
              onChange={(e) => updateConfigItem(item.id, "value", e.target.value)}
              placeholder={t(`${item.type}Placeholder`)}
              className="w-2/3"
            />
            <Button variant="ghost" size="icon" onClick={() => removeConfigItem(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-8 max-w-7xl">
      {/* 页面标题和描述 */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          Docker Run 转换器
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          将 Docker Run 命令智能转换为 Docker Compose 文件，支持复杂参数解析和多种配置选项
        </p>
      </div>

      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="converter" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            命令转换器
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            配置生成器
          </TabsTrigger>
        </TabsList>

        {/* 转换器选项卡内容 */}
        <TabsContent value="converter" className="space-y-6">
          {/* 设置选项卡 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  转换设置
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "收起" : "高级设置"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto-convert"
                          checked={autoConvert}
                          onCheckedChange={setAutoConvert}
                        />
                        <Label htmlFor="auto-convert" className="cursor-pointer">
                          自动转换
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      输入命令时自动转换为 Docker Compose
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {showAdvanced && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="compose-version" className="text-sm">
                        Compose 版本:
                      </Label>
                      <Select value={composeVersion} onValueChange={setComposeVersion}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3.9">3.9</SelectItem>
                          <SelectItem value="3.8">3.8</SelectItem>
                          <SelectItem value="3.7">3.7</SelectItem>
                          <SelectItem value="2.4">2.4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 命令输入区域 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                Docker Run 命令
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={dockerRunCommand}
                onChange={(e) => setDockerRunCommand(e.target.value)}
                placeholder="粘贴或输入您的 docker run 命令..."
                className="font-mono text-sm min-h-[120px] resize-y"
                rows={6}
              />
              
              {/* 示例命令 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">示例命令</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {examples.map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleExampleClick(example.command)}
                      className="justify-start text-left h-auto py-2 px-3"
                    >
                      <div>
                        <div className="font-medium text-xs">{example.name}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {example.command.substring(0, 50)}...
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 转换按钮 */}
              <div className="flex gap-2">
                <Button 
                  onClick={convertToDockerCompose}
                  disabled={!dockerRunCommand.trim() || isParsingCommand}
                  className="flex items-center gap-2"
                >
                  {isParsingCommand ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isParsingCommand ? "转换中..." : "转换为 Compose"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDockerRunCommand("")
                    setDockerComposeYaml("")
                    setParseResult(null)
                    setValidationErrors([])
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 错误和警告显示 */}
          {(validationErrors.length > 0 || (parseResult && parseResult.warnings.length > 0)) && (
            <div className="space-y-3">
              {validationErrors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">解析错误:</div>
                      {validationErrors.map((error, index) => (
                        <div key={index} className="text-sm">• {error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {parseResult && parseResult.warnings.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10">
                  <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium text-yellow-800 dark:text-yellow-200">注意事项:</div>
                      {parseResult.warnings.map((warning, index) => (
                        <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">• {warning}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 解析结果显示 */}
          {parseResult && Object.keys(parseResult.services).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  解析结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(parseResult.services).map(([serviceName, service]) => (
                    <div key={serviceName} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary">{serviceName}</Badge>
                        {service.image && (
                          <Badge variant="outline">{service.image}</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {service.ports && service.ports.length > 0 && (
                          <div>
                            <span className="font-medium text-blue-600">端口:</span>
                            <div className="mt-1 space-y-1">
                              {(() => {
                                const portKey = `${serviceName}-ports`
                                const isExpanded = expandedSections[portKey]
                                const shouldShowToggle = service.ports!.length > 3
                                const visiblePorts = isExpanded ? service.ports! : service.ports!.slice(0, 3)
                                
                                return (
                                  <>
                                    {visiblePorts.map((port, idx) => (
                                      <div key={idx} className="font-mono text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
                                        {port}
                                      </div>
                                    ))}
                                    {shouldShowToggle && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(portKey)}
                                        className="h-6 text-xs text-gray-500 hover:text-gray-700 p-1"
                                      >
                                        {isExpanded ? (
                                          <>收起 ({service.ports!.length})</>
                                        ) : (
                                          <>+{service.ports!.length - 3} 更多...</>
                                        )}
                                      </Button>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                        
                        {service.volumes && service.volumes.length > 0 && (
                          <div>
                            <span className="font-medium text-green-600">卷挂载:</span>
                            <div className="mt-1 space-y-1">
                              {(() => {
                                const volumeKey = `${serviceName}-volumes`
                                const isExpanded = expandedSections[volumeKey]
                                const shouldShowToggle = service.volumes!.length > 3
                                const visibleVolumes = isExpanded ? service.volumes! : service.volumes!.slice(0, 3)
                                
                                return (
                                  <>
                                    {visibleVolumes.map((volume, idx) => (
                                      <div key={idx} className="font-mono text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
                                        {volume}
                                      </div>
                                    ))}
                                    {shouldShowToggle && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(volumeKey)}
                                        className="h-6 text-xs text-gray-500 hover:text-gray-700 p-1"
                                      >
                                        {isExpanded ? (
                                          <>收起 ({service.volumes!.length})</>
                                        ) : (
                                          <>+{service.volumes!.length - 3} 更多...</>
                                        )}
                                      </Button>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                        
                        {service.environment && service.environment.length > 0 && (
                          <div>
                            <span className="font-medium text-purple-600">环境变量:</span>
                            <div className="mt-1 space-y-1">
                              {(() => {
                                const envKey = `${serviceName}-env`
                                const isExpanded = expandedSections[envKey]
                                const shouldShowToggle = service.environment!.length > 3
                                const visibleEnvs = isExpanded ? service.environment! : service.environment!.slice(0, 3)
                                
                                return (
                                  <>
                                    {visibleEnvs.map((env, idx) => (
                                      <div key={idx} className="font-mono text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
                                        {env}
                                      </div>
                                    ))}
                                    {shouldShowToggle && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(envKey)}
                                        className="h-6 text-xs text-gray-500 hover:text-gray-700 p-1"
                                      >
                                        {isExpanded ? (
                                          <>收起 ({service.environment!.length})</>
                                        ) : (
                                          <>+{service.environment!.length - 3} 更多...</>
                                        )}
                                      </Button>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Docker Compose 输出 */}
          {dockerComposeYaml && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Docker Compose 文件
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(dockerComposeYaml, setCopied)}
                    className="flex items-center gap-2"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={yamlRef} className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto">
                  <pre className="text-sm font-mono whitespace-pre">{dockerComposeYaml}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 生成器选项卡内容 */}
        <TabsContent value="generator" className="space-y-6">
          {/* 基本配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                基本配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="imageName">镜像名称 *</Label>
                  <Input
                    id="imageName"
                    value={imageName}
                    onChange={(e) => setImageName(e.target.value)}
                    placeholder="nginx:latest"
                  />
                </div>
                <div>
                  <Label htmlFor="containerName">容器名称</Label>
                  <Input
                    id="containerName"
                    value={containerName}
                    onChange={(e) => setContainerName(e.target.value)}
                    placeholder="my-container (可选)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 配置项管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                配置项管理
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 配置项列表 */}
              {configItems.length > 0 && (
                <div className="space-y-3">
                  {configItems.map((item) => renderConfigItemInput(item))}
                </div>
              )}

              {/* 添加配置项按钮 */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  添加配置项:
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("port")}>
                    <Plus className="h-4 w-4 mr-1" /> 端口
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("volume")}>
                    <Plus className="h-4 w-4 mr-1" /> 卷挂载
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("env")}>
                    <Plus className="h-4 w-4 mr-1" /> 环境变量
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("restart")}>
                    <Plus className="h-4 w-4 mr-1" /> 重启策略
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("network")}>
                    <Plus className="h-4 w-4 mr-1" /> 网络
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("memory")}>
                    <Plus className="h-4 w-4 mr-1" /> 内存
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("cpu")}>
                    <Plus className="h-4 w-4 mr-1" /> CPU
                  </Button>
                </div>
              </div>

              <Button onClick={generateDockerCommands} className="w-full flex items-center gap-2">
                <Zap className="h-4 w-4" />
                生成 Docker 命令
              </Button>
            </CardContent>
          </Card>

          {/* 生成的Docker命令输出 */}
          {generatedDockerRun && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Docker Run 命令
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedDockerRun, setCopiedGenerated)}
                    className="flex items-center gap-2"
                  >
                    {copiedGenerated ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedGenerated ? "已复制" : "复制"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto">
                  <pre className="text-sm font-mono whitespace-pre-wrap break-all">{generatedDockerRun}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 生成的Docker Compose输出 */}
          {generatedDockerCompose && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Docker Compose 文件
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedDockerCompose, setCopiedGenerated)}
                    className="flex items-center gap-2"
                  >
                    {copiedGenerated ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedGenerated ? "已复制" : "复制"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto">
                  <pre className="text-sm font-mono whitespace-pre">{generatedDockerCompose}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
