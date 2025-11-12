// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // 모바일 메뉴 토글 기능
    initMobileMenu();
    
    // 현재 페이지 파일명 추출 함수
    function getCurrentPageFile() {
        const pathname = window.location.pathname;
        let fileName = pathname.split('/').pop();
        
        // 빈 경로나 루트 경로인 경우 index.html로 처리
        if (!fileName || fileName === '' || fileName === '/') {
            fileName = 'index.html';
        }
        
        return fileName.toLowerCase();
    }
    
    // href에서 파일명 추출 함수
    function getHrefFile(href) {
        if (!href) return '';
        // 상대 경로에서 파일명만 추출
        const hrefFile = href.split('/').pop();
        // 쿼리나 해시 제거
        return hrefFile.split('?')[0].split('#')[0].toLowerCase();
    }
    
    // 링크가 활성화되어야 하는지 확인하는 함수
    function shouldBeActive(href) {
        const currentFile = getCurrentPageFile();
        const hrefFile = getHrefFile(href);
        
        // 정확히 일치하는 경우
        if (hrefFile === currentFile) {
            return true;
        }
        
        // index.html 처리
        if (currentFile === 'index.html' && (hrefFile === 'index.html' || hrefFile === '')) {
            return true;
        }
        
        return false;
    }
    
    // 네비게이션 활성화 함수 (공통)
    function activateNavigation(links) {
        if (!links || links.length === 0) return;
        
        links.forEach(link => {
            // 먼저 모든 active 클래스 제거
            link.classList.remove('active');
            
            const href = link.getAttribute('href');
            if (!href) return;
            
            if (shouldBeActive(href)) {
                link.classList.add('active');
            }
        });
    }
    
    // 현재 페이지 파일명
    const currentFile = getCurrentPageFile();
    
    // 푸터 네비게이션 링크 활성화
    const footerNavLinks = document.querySelectorAll('.footer-nav a');
    if (footerNavLinks && footerNavLinks.length > 0) {
        footerNavLinks.forEach(link => {
            // 먼저 모든 active 클래스 제거
            link.classList.remove('active');
            
            const href = link.getAttribute('href');
            if (!href) return;
            
            const hrefFile = getHrefFile(href);
            
            // 현재 페이지와 비교
            let isActive = false;
            
            // 정확히 일치하는 경우
            if (hrefFile === currentFile) {
                isActive = true;
            }
            // index.html 처리
            else if (currentFile === 'index.html' && (hrefFile === 'index.html' || hrefFile === '')) {
                isActive = true;
            }
            
            if (isActive) {
                link.classList.add('active');
            }
        });
    }
    
    // 상단 네비게이션 버튼 활성화 (푸터와 동일한 로직)
    const navButtons = document.querySelectorAll('.nav-button');
    if (navButtons && navButtons.length > 0) {
        navButtons.forEach(button => {
            // 먼저 모든 active 클래스 제거
            button.classList.remove('active');
            
            const href = button.getAttribute('href');
            if (!href) return;
            
            const hrefFile = getHrefFile(href);
            
            // 현재 페이지와 비교
            let isActive = false;
            
            // 정확히 일치하는 경우
            if (hrefFile === currentFile) {
                isActive = true;
            }
            // index.html 처리
            else if (currentFile === 'index.html' && (hrefFile === 'index.html' || hrefFile === '')) {
                isActive = true;
            }
            
            if (isActive) {
                button.classList.add('active');
            }
        });
    }

    // 메인 페이지에서 스크롤에 따라 헤더 표시/숨김
    const isMainPage = document.body.classList.contains('main-page');
    if (isMainPage) {
        let lastScrollTop = 0;
        const header = document.querySelector('.header');
        const scrollThreshold = 10; // 스크롤 임계값
        
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > scrollThreshold) {
                // 스크롤 다운
                if (scrollTop > lastScrollTop) {
                    header.classList.add('hidden');
                } else {
                    // 스크롤 업
                    header.classList.remove('hidden');
                }
            } else {
                // 맨 위로 스크롤
                header.classList.remove('hidden');
            }
            
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        }, false);
    }

    // 로고 이미지 로드 실패 시 대체 텍스트 표시
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('error', function() {
            this.style.display = 'none';
            const logoLink = this.parentElement;
            const logoArea = logoLink.parentElement;
            if (!logoArea.querySelector('.logo-placeholder')) {
                const placeholder = document.createElement('div');
                placeholder.className = 'logo-placeholder';
                placeholder.textContent = '로고';
                placeholder.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f0f0f0; color: #666; border-radius: 4px; font-weight: 600;';
                logoLink.appendChild(placeholder);
            }
        });
    }

    // 부드러운 스크롤 (필요한 경우)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // 모바일 메뉴 초기화 함수
    function initMobileMenu() {
        const header = document.querySelector('.header');
        const navigation = document.querySelector('.navigation');
        
        if (!header || !navigation) return;

        // 모바일 메뉴 버튼이 없으면 생성
        let menuButton = header.querySelector('.mobile-menu-button');
        if (!menuButton) {
            menuButton = document.createElement('button');
            menuButton.className = 'mobile-menu-button';
            menuButton.setAttribute('aria-label', '메뉴');
            menuButton.innerHTML = '<span></span><span></span><span></span>';
            header.appendChild(menuButton);
        }

        // 메뉴 버튼 클릭 이벤트
        menuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            navigation.classList.toggle('active');
        });

        // 메뉴 외부 클릭 시 닫기
        document.addEventListener('click', function(e) {
            if (!navigation.contains(e.target) && !menuButton.contains(e.target)) {
                menuButton.classList.remove('active');
                navigation.classList.remove('active');
            }
        });

        // 메뉴 링크 클릭 시 메뉴 닫기
        const navLinks = navigation.querySelectorAll('.nav-button');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                menuButton.classList.remove('active');
                navigation.classList.remove('active');
            });
        });

        // 윈도우 리사이즈 시 메뉴 상태 초기화
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth > 768) {
                    menuButton.classList.remove('active');
                    navigation.classList.remove('active');
                }
            }, 250);
        });
    }
});
