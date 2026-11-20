import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'퓨처로드 · 주행 채점',description:'성공을 기록하고 도전을 응원하는 퓨처로드 주행 채점 시스템',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
