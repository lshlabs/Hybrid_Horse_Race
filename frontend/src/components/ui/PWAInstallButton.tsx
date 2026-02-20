import { useState, useEffect } from 'react'
import { Smartphone, Share, Ellipsis, SquarePlus, Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent } from './dialog'
import { Button } from './button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

export function PWAInstallButton() {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)

  // 첫 로딩 시 툴팁 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTooltipVisible(true)
    }, 500) // 0.5초 후 표시

    return () => clearTimeout(timer)
  }, [])

  // iOS 감지
  const isIOS = () => {
    const userAgent = navigator.userAgent || navigator.vendor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    return /iPad|iPhone|iPod/.test(userAgent) && !win.MSStream
  }

  // Android 감지
  const isAndroid = () => {
    const userAgent = navigator.userAgent || navigator.vendor
    return /android/i.test(userAgent)
  }

  // 모바일 환경 감지
  const isMobile = () => {
    return isIOS() || isAndroid()
  }

  // 기본 탭 선택 (현재 플랫폼에 맞게)
  const getDefaultTab = (): string => {
    if (isIOS()) return 'ios'
    if (isAndroid()) return 'android'
    return 'desktop'
  }

  const [activeTab, setActiveTab] = useState<string>(getDefaultTab)

  // 모바일이 아니면 버튼을 표시하지 않음
  if (!isMobile()) {
    return null
  }

  return (
    <TooltipProvider>
      <div className="relative ml-2">
        <Tooltip open={isTooltipVisible} onOpenChange={setIsTooltipVisible}>
          <TooltipTrigger asChild>
            <Button onClick={() => setIsModalOpen(true)} size="sm">
              <Smartphone className="h-4 w-4" />
              <span>{t('pwa.install')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="cursor-pointer"
            onClick={() => setIsTooltipVisible(false)}
          >
            <p>{t('pwa.tooltip')}</p>
          </TooltipContent>
        </Tooltip>

        {/* PWA 설치 가이드 모달 */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md w-[90%] rounded-3xl border-none bg-surface [&>button]:hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="ios"
                  className="flex items-center gap-2 data-[state=active]:bg-primary"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 fill-current"
                  >
                    <title>Apple</title>
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                  </svg>
                  iOS
                </TabsTrigger>
                <TabsTrigger
                  value="android"
                  className="flex items-center gap-2 data-[state=active]:bg-primary"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 fill-current"
                  >
                    <title>Android</title>
                    <path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" />
                  </svg>
                  Android
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ios" className="space-y-4 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">{t('pwa.ios.title')}</p>
                  <ol className="list-decimal space-y-2 pl-5">
                    <li>
                      {t('pwa.ios.step1')}{' '}
                      <span className="inline-flex items-center bg-secondary text-secondary-foreground rounded-md px-1 py-1">
                        <Ellipsis className="h-4 w-4 mx-1 " />
                      </span>{' '}
                      {t('pwa.ios.step1Action')}
                    </li>
                    <li>
                      <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-1">
                        <Share className="h-4 w-4" />
                        <span className="font-semibold">{t('pwa.ios.step2')}</span>
                      </span>{' '}
                      {t('pwa.ios.select')}
                    </li>
                    <li>
                      <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-1">
                        <SquarePlus className="h-4 w-4" />
                        <span className="font-semibold">{t('pwa.ios.step3')}</span>
                      </span>{' '}
                      {t('pwa.ios.select')}
                    </li>
                  </ol>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {t('pwa.ios.info')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="android" className="space-y-4 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">{t('pwa.android.title')}</p>
                  <ol className="list-decimal space-y-2 pl-5">
                    <li>
                      {t('pwa.android.step1')}{' '}
                      <span className="inline-flex items-center bg-secondary text-secondary-foreground rounded-md px-1 py-1">
                        <Ellipsis className="h-4 w-4 mx-1 " />
                      </span>{' '}
                      {t('pwa.android.step1Action')}
                    </li>
                    <li>
                      <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-md px-2 py-1">
                        <SquarePlus className="h-4 w-4" />
                        <span className="font-semibold">{t('pwa.android.step2')}</span>
                      </span>{' '}
                      {t('pwa.android.select')}
                    </li>
                  </ol>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="text-xs text-muted-foreground flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {t('pwa.android.info')}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
