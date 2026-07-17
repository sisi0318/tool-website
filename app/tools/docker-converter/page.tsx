"use client"

import { copyTextToClipboard } from "@/lib/clipboard"

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
import { getDockerInlineOptionValue, tokenizeDockerCommand } from "@/lib/docker-command-tools"

// 定义配置项接口
interface ConfigItem {
  id: string
  type: "port" | "volume" | "env" | "restart" | "network" | "memory" | "cpu"
  value: string
  hostValue?: string
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
  mem_limit?: string
  mem_reservation?: string
  cpus?: string
  privileged?: boolean
  cap_add?: string[]
  cap_drop?: string[]
  tmpfs?: string[]
  shm_size?: string
  logging?: {
    driver?: string
    options?: Record<string, string>
  }
}

// 解析结果接口
interface ParseResult {
  services: Record<string, DockerService>
  errors: string[]
  warnings: string[]
}

export default function DockerConverterPage() {
  const t = useTranslations("dockerConverter")
  const [dockerRunCommand, setDockerRunCommand] = useState("")
  const [dockerComposeYaml, setDockerComposeYaml] = useState("")
  // 自定义配置项状态
  const [imageName, setImageName] = useState("nginx")
  const [containerName, setContainerName] = useState("")
  const [configItems, setConfigItems] = useState<ConfigItem[]>([])
  const [generatedDockerRun, setGeneratedDockerRun] = useState("")
  const [generatedDockerCompose, setGeneratedDockerCompose] = useState("")
  const [copiedTarget, setCopiedTarget] = useState<"converted" | "run" | "generatedCompose" | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyResetTimerRef = useRef<number | null>(null)

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
      const cleanCommand = command.trim().replace(/\\\s*\r?\n\s*/g, " ")
      
      if (!/^docker\s+run(?:\s|$)/.test(cleanCommand)) {
        result.errors.push(t("mustStartWithDockerRun"))
        return result
      }

      // 提取命令部分
      const commandPart = cleanCommand.replace(/^docker\s+run(?:\s|$)/, "").trim()
      
      // 使用更智能的参数解析
      const args = tokenizeDockerCommand(commandPart)
      
      if (args.length === 0) {
        result.errors.push(t("noArgumentsOrImage"))
        return result
      }

      // 初始化服务配置
      let serviceName = 'app'
      let imageFound = false
      const service: DockerService = {}

      // 解析参数
      for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        // Everything after the image belongs to the container command, even flags.
        if (imageFound) {
          service.command = service.command ? `${service.command} ${arg}` : arg
          continue
        }

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
              result.errors.push(`--name ${t("requiresValue")}`)
            }
            break

          case '-p':
          case '--publish':
            if (i + 1 < args.length) {
              if (!service.ports) service.ports = []
              service.ports.push(args[++i])
            } else {
              result.errors.push(`-p/--publish ${t("requiresValue")}`)
            }
            break

          case '-v':
          case '--volume':
          case '--mount':
            if (i + 1 < args.length) {
              if (!service.volumes) service.volumes = []
              service.volumes.push(args[++i])
            } else {
              result.errors.push(`-v/--volume ${t("requiresValue")}`)
            }
            break

          case '-e':
          case '--env':
            if (i + 1 < args.length) {
              if (!service.environment) service.environment = []
              service.environment.push(args[++i])
            } else {
              result.errors.push(`-e/--env ${t("requiresValue")}`)
            }
            break

          case '--env-file':
            if (i + 1 < args.length) {
              i++ // 跳过文件名
              result.warnings.push(t("envFileWarning"))
            }
            break

          case '-l':
          case '--label':
            if (i + 1 < args.length) {
              if (!service.labels) service.labels = []
              service.labels.push(args[++i])
            } else {
              result.errors.push(`-l/--label ${t("requiresValue")}`)
            }
            break

          case '--restart':
            if (i + 1 < args.length) {
              service.restart = args[++i]
            } else {
              result.errors.push(`--restart ${t("requiresValue")}`)
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
            result.warnings.push(t("interactiveWarning"))
            break

          case '--rm':
            result.warnings.push(t("removeWarning"))
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
              service.shm_size = getDockerInlineOptionValue(arg, "--shm-size") ?? undefined
            } else if (arg.startsWith('--memory=') || arg.startsWith('-m=')) {
              service.mem_limit = arg.includes('=') ? arg.split('=')[1] : arg
            } else if (arg.startsWith('--cpus=')) {
              service.cpus = getDockerInlineOptionValue(arg, "--cpus") ?? undefined
            } else if (arg.startsWith('--user=') || arg.startsWith('-u=')) {
              service.user = arg.includes('=') ? arg.split('=')[1] : arg
            } else if (arg.startsWith('--workdir=') || arg.startsWith('-w=')) {
              service.working_dir = arg.includes('=') ? arg.split('=')[1] : arg
            } else if (arg.startsWith('--name=')) {
              const name = getDockerInlineOptionValue(arg, "--name") ?? ""
              serviceName = name.replace(/[^a-zA-Z0-9_-]/g, '_')
              service.container_name = name
            } else if (arg.startsWith('--restart=')) {
              service.restart = getDockerInlineOptionValue(arg, "--restart") ?? undefined
            } else if (arg.startsWith('--network=')) {
              const network = getDockerInlineOptionValue(arg, "--network") ?? ""
              if (network === 'host' || network === 'none' || network === 'bridge') {
                service.network_mode = network
              } else {
                if (!service.networks) service.networks = []
                service.networks.push(network)
              }
            } else if (arg.startsWith('--cap-add=')) {
              if (!service.cap_add) service.cap_add = []
              service.cap_add.push(getDockerInlineOptionValue(arg, "--cap-add") ?? "")
            } else if (arg.startsWith('--cap-drop=')) {
              if (!service.cap_drop) service.cap_drop = []
              service.cap_drop.push(getDockerInlineOptionValue(arg, "--cap-drop") ?? "")
            } else if (arg.startsWith('--tmpfs=')) {
              if (!service.tmpfs) service.tmpfs = []
              service.tmpfs.push(getDockerInlineOptionValue(arg, "--tmpfs") ?? "")
            } else if (arg.startsWith('--log-driver=')) {
              if (!service.logging) service.logging = {}
              service.logging.driver = getDockerInlineOptionValue(arg, "--log-driver") ?? ""
            } else if (arg.startsWith('--health-cmd=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.test = ['CMD-SHELL', getDockerInlineOptionValue(arg, "--health-cmd") ?? ""]
            } else if (arg.startsWith('--health-interval=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.interval = getDockerInlineOptionValue(arg, "--health-interval") ?? ""
            } else if (arg.startsWith('--health-timeout=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.timeout = getDockerInlineOptionValue(arg, "--health-timeout") ?? ""
            } else if (arg.startsWith('--health-retries=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.retries = Number.parseInt(getDockerInlineOptionValue(arg, "--health-retries") ?? "", 10)
            } else if (arg.startsWith('--health-start-period=')) {
              if (!service.healthcheck) service.healthcheck = {}
              service.healthcheck.start_period = getDockerInlineOptionValue(arg, "--health-start-period") ?? ""
            } else if (arg.startsWith('--entrypoint=')) {
              service.entrypoint = getDockerInlineOptionValue(arg, "--entrypoint") ?? ""
            } else if (arg.startsWith('--memory-reservation=')) {
              service.mem_reservation = getDockerInlineOptionValue(arg, "--memory-reservation") ?? ""
            } else if (arg.startsWith('--publish=')) {
              if (!service.ports) service.ports = []
              service.ports.push(getDockerInlineOptionValue(arg, "--publish") ?? "")
            } else if (arg.startsWith('--volume=')) {
              if (!service.volumes) service.volumes = []
              service.volumes.push(getDockerInlineOptionValue(arg, "--volume") ?? "")
            } else if (arg.startsWith('--env=')) {
              if (!service.environment) service.environment = []
              service.environment.push(getDockerInlineOptionValue(arg, "--env") ?? "")
            } else if (arg.startsWith('--label=')) {
              if (!service.labels) service.labels = []
              service.labels.push(getDockerInlineOptionValue(arg, "--label") ?? "")
            } else if (arg.startsWith('-') && !imageFound) {
              result.warnings.push(`${t("unrecognizedOption")}: ${arg}`)
            }
            break
        }
      }

      if (!imageFound) {
        result.errors.push(t("imageNotFound"))
        return result
      }

      result.services[serviceName] = service

    } catch (error) {
      result.errors.push(`${t("parseError")}: ${(error as Error).message}`)
    }

    return result
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
      console.error("Docker conversion error:", error)
      const errorMessage = `${t("conversionFailed")}: ${(error as Error).message}`
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
      if (service.mem_limit) limits.push(`          memory: ${service.mem_limit}`)
      if (service.cpus) limits.push(`          cpus: '${service.cpus}'`)
      
      if (limits.length > 0) {
        yaml += "    deploy:\n"
        yaml += "      resources:\n"
        yaml += "        limits:\n"
        yaml += limits.join('\n') + '\n'
      }
      if (service.mem_reservation) {
        if (limits.length === 0) {
          yaml += "    deploy:\n"
          yaml += "      resources:\n"
        }
        yaml += "        reservations:\n"
        yaml += `          memory: ${service.mem_reservation}\n`
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

  const copyToClipboard = (text: string, target: "converted" | "run" | "generatedCompose") => {
    if (text) {
      void copyTextToClipboard(text).then((success) => {
        if (!success) {
          setCopyFailed(true)
          return
        }

        setCopyFailed(false)
        setCopiedTarget(target)
        if (copyResetTimerRef.current !== null) {
          window.clearTimeout(copyResetTimerRef.current)
        }
        copyResetTimerRef.current = window.setTimeout(() => {
          setCopiedTarget(null)
          copyResetTimerRef.current = null
        }, 2000)
      })
    }
  }

  // 自动转换监听
  useEffect(() => {
    if (!autoConvert) return

    if (!dockerRunCommand.trim()) {
      setParseResult(null)
      setDockerComposeYaml("")
      setValidationErrors([])
      return
    }

    const timer = window.setTimeout(() => {
      convertToDockerCompose()
    }, 500)

    return () => window.clearTimeout(timer)
  }, [dockerRunCommand, autoConvert, composeVersion])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  const handleExampleClick = (example: string) => {
    setDockerRunCommand(example)
    if (!autoConvert) {
      const result = parseDockerRunCommand(example)
      setParseResult(result)
      if (result.errors.length === 0) {
        setDockerComposeYaml(generateDockerComposeYaml(result, composeVersion))
        setValidationErrors([])
      } else {
        setDockerComposeYaml("")
        setValidationErrors(result.errors)
      }
    }
  }

  // 示例命令
  const examples = [
    {
      name: t("exampleNginx"),
      command: "docker run --name nginx-server -p 80:80 -p 443:443 -v /var/www/html:/usr/share/nginx/html:ro -v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro --restart unless-stopped nginx:latest"
    },
    {
      name: t("exampleMySql"),
      command: "docker run --name mysql-db -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=myapp -e MYSQL_USER=appuser -e MYSQL_PASSWORD=apppass -p 3306:3306 -v mysql-data:/var/lib/mysql --restart always mysql:8.0"
    },
    {
      name: t("exampleRedis"),
      command: "docker run --name redis-cache -p 6379:6379 -v redis-data:/data --restart always --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 redis:alpine redis-server --appendonly yes"
    },
    {
      name: t("exampleNode"),
      command: 'docker run --name node-app -p 3000:3000 -e NODE_ENV=production -e PORT=3000 -v /app/uploads:/app/uploads -w /app --user 1000:1000 --memory=512m --cpus=0.5 --health-cmd="curl -f http://localhost:3000/health || exit 1" --health-interval=30s --health-timeout=3s --health-retries=3 node:18-alpine npm start'
    },
    {
      name: t("examplePostgres"),
      command: "docker run --name postgres-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=myapp -e POSTGRES_USER=appuser -p 5432:5432 -v postgres-data:/var/lib/postgresql/data --restart always --shm-size=256m postgres:15-alpine"
    },
    {
      name: t("exampleComplex"),
      command: 'docker run --name complex-app -p 8080:8080 -p 8443:8443 -e APP_ENV=production -e DATABASE_URL="postgres://user:pass@db:5432/app" -v /app/logs:/var/log/app -v /app/uploads:/var/uploads --network=app-network --restart=unless-stopped --memory=1g --cpus=1.0 --cap-add=NET_ADMIN --cap-drop=ALL --tmpfs /tmp:rw,size=100m --log-driver=fluentd --log-opt fluentd-address=localhost:24224 --log-opt tag=app.{{.Name}} --health-cmd="curl -f http://localhost:8080/api/health" --health-interval=30s --health-timeout=10s --health-retries=3 --health-start-period=60s myapp:latest'
    }
  ]

  // 添加配置项
  const addConfigItem = (type: ConfigItem["type"]) => {
    const newItem: ConfigItem = {
      id: crypto.randomUUID(),
      type,
      value: "",
      hostValue: type === "port" || type === "volume" ? "" : undefined,
    }
    setConfigItems((currentItems) => [...currentItems, newItem])
  }

  // 删除配置项
  const removeConfigItem = (id: string) => {
    setConfigItems((currentItems) => currentItems.filter((item) => item.id !== id))
  }

  // 更新配置项
  const updateConfigItem = (id: string, field: "value" | "hostValue", value: string) => {
    setConfigItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
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
      console.error("Docker command generation error:", error)
      setGeneratedDockerRun(t("generationError") + ": " + (error as Error).message)
      setGeneratedDockerCompose(t("generationError") + ": " + (error as Error).message)
    }
  }

  // 渲染配置项输入表单
  const renderConfigItemInput = (item: ConfigItem) => {
    switch (item.type) {
      case "port":
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]" key={item.id}>
            <Input
              value={item.hostValue || ""}
              onChange={(e) => updateConfigItem(item.id, "hostValue", e.target.value)}
              placeholder={t("hostPort")}
              className="min-w-0"
            />
            <ArrowRight className="hidden h-4 w-4 flex-shrink-0 sm:block" aria-hidden="true" />
            <Input
              value={item.value}
              onChange={(e) => updateConfigItem(item.id, "value", e.target.value)}
              placeholder={t("containerPort")}
              className="min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeConfigItem(item.id)}
              className="col-start-2 row-span-2 row-start-1 sm:col-start-4 sm:row-span-1"
              aria-label={t("removeConfiguration")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )

      case "volume":
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]" key={item.id}>
            <Input
              value={item.hostValue || ""}
              onChange={(e) => updateConfigItem(item.id, "hostValue", e.target.value)}
              placeholder={t("hostPath")}
              className="min-w-0"
            />
            <ArrowRight className="hidden h-4 w-4 flex-shrink-0 sm:block" aria-hidden="true" />
            <Input
              value={item.value}
              onChange={(e) => updateConfigItem(item.id, "value", e.target.value)}
              placeholder={t("containerPath")}
              className="min-w-0"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeConfigItem(item.id)}
              className="col-start-2 row-span-2 row-start-1 sm:col-start-4 sm:row-span-1"
              aria-label={t("removeConfiguration")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )

      case "restart":
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" key={item.id}>
            <Select value={item.value} onValueChange={(value) => updateConfigItem(item.id, "value", value)}>
              <SelectTrigger className="min-w-0">
                <SelectValue placeholder={t("selectRestartPolicy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">no</SelectItem>
                <SelectItem value="always">always</SelectItem>
                <SelectItem value="on-failure">on-failure</SelectItem>
                <SelectItem value="unless-stopped">unless-stopped</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => removeConfigItem(item.id)} aria-label={t("removeConfiguration")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )

      default:
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2" key={item.id}>
            <Input
              value={item.value}
              onChange={(e) => updateConfigItem(item.id, "value", e.target.value)}
              placeholder={t(`${item.type}Placeholder`)}
              className="min-w-0"
            />
            <Button variant="ghost" size="icon" onClick={() => removeConfigItem(item.id)} aria-label={t("removeConfiguration")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
    }
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-3 py-4 sm:space-y-8 sm:px-4 sm:py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
      </div>

      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 bg-[var(--md-sys-color-surface-container)] p-1">
          <TabsTrigger value="converter" className="flex min-w-0 items-center gap-1.5 px-2 py-2.5 data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="truncate">{t("converterTab")}</span>
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex min-w-0 items-center gap-1.5 px-2 py-2.5 data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2">
            <Zap className="h-4 w-4" />
            <span className="truncate">{t("generatorTab")}</span>
          </TabsTrigger>
        </TabsList>

        {copyFailed && (
          <Alert className="mt-4 border-[var(--md-sys-color-error)]/30 bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t("copyError")}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="converter" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5" />
                  {t("conversionSettings")}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  aria-expanded={showAdvanced}
                >
                  {showAdvanced ? t("collapse") : t("advancedSettings")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
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
                          {t("autoConvert")}
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("autoConvertHelp")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {showAdvanced && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="compose-version" className="text-sm">
                        {t("composeVersion")}:
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                {t("dockerRunCommand")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label htmlFor="docker-run-command" className="sr-only">{t("dockerRunCommand")}</Label>
              <Textarea
                id="docker-run-command"
                value={dockerRunCommand}
                onChange={(e) => setDockerRunCommand(e.target.value)}
                placeholder={t("commandPlaceholder")}
                className="min-h-[140px] resize-y font-mono text-sm"
                rows={6}
              />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                  <span className="text-sm font-medium">{t("examples")}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {examples.map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleExampleClick(example.command)}
                      className="h-auto w-full min-w-0 justify-start overflow-hidden px-3 py-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs">{example.name}</div>
                        <div className="mt-1 truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {example.command.substring(0, 50)}...
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:flex">
                <Button 
                  onClick={convertToDockerCompose}
                  disabled={!dockerRunCommand.trim() || isParsingCommand}
                  className="w-full items-center gap-2 sm:w-auto"
                >
                  {isParsingCommand ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isParsingCommand ? t("converting") : t("convertToCompose")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setDockerRunCommand("")
                    setDockerComposeYaml("")
                    setParseResult(null)
                    setValidationErrors([])
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("clear")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {(validationErrors.length > 0 || (parseResult && parseResult.warnings.length > 0)) && (
            <div className="space-y-3">
              {validationErrors.length > 0 && (
                <Alert className="border-[var(--md-sys-color-error)]/30 bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">{t("parseErrors")}:</div>
                      {validationErrors.map((error, index) => (
                        <div key={index} className="text-sm">• {error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {parseResult && parseResult.warnings.length > 0 && (
                <Alert className="border-[var(--md-sys-color-tertiary)]/30 bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">{t("notices")}:</div>
                      {parseResult.warnings.map((warning, index) => (
                        <div key={index} className="text-sm">• {warning}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {parseResult && Object.keys(parseResult.services).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("parseResult")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(parseResult.services).map(([serviceName, service]) => (
                    <div key={serviceName} className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3 sm:p-4">
                      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant="secondary">{serviceName}</Badge>
                        {service.image && (
                          <Badge variant="outline" className="max-w-full truncate">{service.image}</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {service.ports && service.ports.length > 0 && (
                          <div>
                            <span className="font-medium text-[var(--md-sys-color-primary)]">{t("ports")}:</span>
                            <div className="mt-1 space-y-1">
                              {(() => {
                                const portKey = `${serviceName}-ports`
                                const isExpanded = expandedSections[portKey]
                                const shouldShowToggle = service.ports!.length > 3
                                const visiblePorts = isExpanded ? service.ports! : service.ports!.slice(0, 3)
                                
                                return (
                                  <>
                                    {visiblePorts.map((port, idx) => (
                                      <div key={idx} className="break-all rounded-lg bg-[var(--md-sys-color-surface-container-lowest)] px-2 py-1 font-mono text-xs">
                                        {port}
                                      </div>
                                    ))}
                                    {shouldShowToggle && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(portKey)}
                                        className="h-7 p-1 text-xs text-[var(--md-sys-color-on-surface-variant)]"
                                        aria-expanded={Boolean(isExpanded)}
                                      >
                                        {isExpanded ? (
                                          <>{t("collapse")} ({service.ports!.length})</>
                                        ) : (
                                          <>+{service.ports!.length - 3} {t("more")}</>
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
                            <span className="font-medium text-[var(--md-sys-color-primary)]">{t("volumes")}:</span>
                            <div className="mt-1 space-y-1">
                              {(() => {
                                const volumeKey = `${serviceName}-volumes`
                                const isExpanded = expandedSections[volumeKey]
                                const shouldShowToggle = service.volumes!.length > 3
                                const visibleVolumes = isExpanded ? service.volumes! : service.volumes!.slice(0, 3)
                                
                                return (
                                  <>
                                    {visibleVolumes.map((volume, idx) => (
                                      <div key={idx} className="break-all rounded-lg bg-[var(--md-sys-color-surface-container-lowest)] px-2 py-1 font-mono text-xs">
                                        {volume}
                                      </div>
                                    ))}
                                    {shouldShowToggle && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(volumeKey)}
                                        className="h-7 p-1 text-xs text-[var(--md-sys-color-on-surface-variant)]"
                                        aria-expanded={Boolean(isExpanded)}
                                      >
                                        {isExpanded ? (
                                          <>{t("collapse")} ({service.volumes!.length})</>
                                        ) : (
                                          <>+{service.volumes!.length - 3} {t("more")}</>
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
                            <span className="font-medium text-[var(--md-sys-color-primary)]">{t("environmentVariables")}:</span>
                            <div className="mt-1 space-y-1">
                              {(() => {
                                const envKey = `${serviceName}-env`
                                const isExpanded = expandedSections[envKey]
                                const shouldShowToggle = service.environment!.length > 3
                                const visibleEnvs = isExpanded ? service.environment! : service.environment!.slice(0, 3)
                                
                                return (
                                  <>
                                    {visibleEnvs.map((env, idx) => (
                                      <div key={idx} className="break-all rounded-lg bg-[var(--md-sys-color-surface-container-lowest)] px-2 py-1 font-mono text-xs">
                                        {env}
                                      </div>
                                    ))}
                                    {shouldShowToggle && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpanded(envKey)}
                                        className="h-7 p-1 text-xs text-[var(--md-sys-color-on-surface-variant)]"
                                        aria-expanded={Boolean(isExpanded)}
                                      >
                                        {isExpanded ? (
                                          <>{t("collapse")} ({service.environment!.length})</>
                                        ) : (
                                          <>+{service.environment!.length - 3} {t("more")}</>
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

          {dockerComposeYaml && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    {t("dockerComposeFile")}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(dockerComposeYaml, "converted")}
                    className="flex items-center gap-2"
                  >
                    {copiedTarget === "converted" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedTarget === "converted" ? t("copied") : t("copy")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-w-full overflow-auto rounded-xl bg-[var(--md-sys-color-inverse-surface)] p-3 text-[var(--md-sys-color-inverse-on-surface)] sm:p-4">
                  <pre className="text-sm font-mono whitespace-pre">{dockerComposeYaml}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("basicConfiguration")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="imageName">{t("imageName")} *</Label>
                  <Input
                    id="imageName"
                    value={imageName}
                    onChange={(e) => setImageName(e.target.value)}
                    placeholder="nginx:latest"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="containerName">{t("containerName")}</Label>
                  <Input
                    id="containerName"
                    value={containerName}
                    onChange={(e) => setContainerName(e.target.value)}
                    placeholder={t("containerNamePlaceholder")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                {t("configurationManagement")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {configItems.length > 0 && (
                <div className="space-y-3">
                  {configItems.map((item) => renderConfigItemInput(item))}
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
                  {t("addConfiguration")}:
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("port")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("port")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("volume")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("volume")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("env")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("environment")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("restart")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("restartPolicy")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("network")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("network")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("memory")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("memory")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addConfigItem("cpu")}>
                    <Plus className="h-4 w-4 mr-1" /> {t("cpu")}
                  </Button>
                </div>
              </div>

              <Button
                onClick={generateDockerCommands}
                disabled={!imageName.trim()}
                className="flex w-full items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {t("generateDockerCommands")}
              </Button>
            </CardContent>
          </Card>

          {generatedDockerRun && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    {t("dockerRunOutput")}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedDockerRun, "run")}
                    className="flex items-center gap-2"
                  >
                    {copiedTarget === "run" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedTarget === "run" ? t("copied") : t("copy")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-w-full overflow-auto rounded-xl bg-[var(--md-sys-color-inverse-surface)] p-3 text-[var(--md-sys-color-inverse-on-surface)] sm:p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap break-all">{generatedDockerRun}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {generatedDockerCompose && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    {t("dockerComposeFile")}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedDockerCompose, "generatedCompose")}
                    className="flex items-center gap-2"
                  >
                    {copiedTarget === "generatedCompose" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedTarget === "generatedCompose" ? t("copied") : t("copy")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-w-full overflow-auto rounded-xl bg-[var(--md-sys-color-inverse-surface)] p-3 text-[var(--md-sys-color-inverse-on-surface)] sm:p-4">
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
