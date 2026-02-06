def get_category_name(android_id: int) -> str:
    mapping = {
        0: "게임",
        1: "오디오",
        2: "비디오",
        3: "이미지",
        4: "소셜",
        5: "뉴스",
        6: "지도",
        7: "생산성"
    }
    return mapping.get(android_id, "기타")

def get_refined_category(category_id: int, package_name: str):
    # 1. 시스템이 숫자를 잘 줬다면(0 이상) 그대로 사용
    if category_id >= 0:
        return category_id
    
    # 2. 시스템이 -1을 줬다면 패키지명 키워드로 자동 분류
    mappings = {
        "youtube": 2,      # 비디오
        "instagram": 4,    # 소셜
        "facebook": 4,
        "game": 0,         # 패키지명에 game이 포함된 경우
        "kakao": 4,        # 메신저
    }
    
    for key, val in mappings.items():
        if key in package_name.lower():
            return val
            
    return -1 # 끝까지 모르면 미분류