import horse1Ready1Url from '../../../../assets/images/horses_new/horse1_ready1.png'
import horse1Ready2Url from '../../../../assets/images/horses_new/horse1_ready2.png'
import horse1Ready3Url from '../../../../assets/images/horses_new/horse1_ready3.png'
import horse1RunUrl from '../../../../assets/images/horses_new/horse1_run.png'
import horse2Ready1Url from '../../../../assets/images/horses_new/horse2_ready1.png'
import horse2Ready2Url from '../../../../assets/images/horses_new/horse2_ready2.png'
import horse2Ready3Url from '../../../../assets/images/horses_new/horse2_ready3.png'
import horse2RunUrl from '../../../../assets/images/horses_new/horse2_run.png'
import horse3Ready1Url from '../../../../assets/images/horses_new/horse3_ready1.png'
import horse3Ready2Url from '../../../../assets/images/horses_new/horse3_ready2.png'
import horse3Ready3Url from '../../../../assets/images/horses_new/horse3_ready3.png'
import horse3RunUrl from '../../../../assets/images/horses_new/horse3_run.png'
import horse4Ready1Url from '../../../../assets/images/horses_new/horse4_ready1.png'
import horse4Ready2Url from '../../../../assets/images/horses_new/horse4_ready2.png'
import horse4Ready3Url from '../../../../assets/images/horses_new/horse4_ready3.png'
import horse4RunUrl from '../../../../assets/images/horses_new/horse4_run.png'
import horse5Ready1Url from '../../../../assets/images/horses_new/horse5_ready1.png'
import horse5Ready2Url from '../../../../assets/images/horses_new/horse5_ready2.png'
import horse5Ready3Url from '../../../../assets/images/horses_new/horse5_ready3.png'
import horse5RunUrl from '../../../../assets/images/horses_new/horse5_run.png'
import horse6Ready1Url from '../../../../assets/images/horses_new/horse6_ready1.png'
import horse6Ready2Url from '../../../../assets/images/horses_new/horse6_ready2.png'
import horse6Ready3Url from '../../../../assets/images/horses_new/horse6_ready3.png'
import horse6RunUrl from '../../../../assets/images/horses_new/horse6_run.png'
import horse7Ready1Url from '../../../../assets/images/horses_new/horse7_ready1.png'
import horse7Ready2Url from '../../../../assets/images/horses_new/horse7_ready2.png'
import horse7Ready3Url from '../../../../assets/images/horses_new/horse7_ready3.png'
import horse7RunUrl from '../../../../assets/images/horses_new/horse7_run.png'
import horse8Ready1Url from '../../../../assets/images/horses_new/horse8_ready1.png'
import horse8Ready2Url from '../../../../assets/images/horses_new/horse8_ready2.png'
import horse8Ready3Url from '../../../../assets/images/horses_new/horse8_ready3.png'
import horse8RunUrl from '../../../../assets/images/horses_new/horse8_run.png'

/**
 * 말 스프라이트시트 URL 매니페스트.
 * - RaceScene preload에서 순회하며 텍스처를 로드한다.
 * - import를 씬 파일에서 분리해, 에셋 교체 시 수정 지점을 한 곳으로 제한한다.
 */
export const horseSpriteSheetUrls: {
  ready1: string
  ready2: string
  ready3: string
  run: string
}[] = [
  { ready1: horse1Ready1Url, ready2: horse1Ready2Url, ready3: horse1Ready3Url, run: horse1RunUrl },
  { ready1: horse2Ready1Url, ready2: horse2Ready2Url, ready3: horse2Ready3Url, run: horse2RunUrl },
  { ready1: horse3Ready1Url, ready2: horse3Ready2Url, ready3: horse3Ready3Url, run: horse3RunUrl },
  { ready1: horse4Ready1Url, ready2: horse4Ready2Url, ready3: horse4Ready3Url, run: horse4RunUrl },
  { ready1: horse5Ready1Url, ready2: horse5Ready2Url, ready3: horse5Ready3Url, run: horse5RunUrl },
  { ready1: horse6Ready1Url, ready2: horse6Ready2Url, ready3: horse6Ready3Url, run: horse6RunUrl },
  { ready1: horse7Ready1Url, ready2: horse7Ready2Url, ready3: horse7Ready3Url, run: horse7RunUrl },
  { ready1: horse8Ready1Url, ready2: horse8Ready2Url, ready3: horse8Ready3Url, run: horse8RunUrl },
]
