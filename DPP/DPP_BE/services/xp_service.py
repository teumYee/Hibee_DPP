from typing import Dict, Any


DOLPHIN_TITLES = [
    (40, "돌.고래.", "번뇌에서 벗어나 해탈의 경지. 나는 돌고래."),
    (21, "슈-팅-스-타 돌고래", "중력을 거스르는 돌고래 - 우주까지 순식간"),
    (11, "파도타는 돌고래", "이제 물살 좀 타나요? 같이 서핑해요!"),
    (6, "초롱초롱 돌고래", "또 물보라를 일으키는 돌고래"),
    (1, "응애 돌고래", "나.. 이제 바다에요")
]

class LevelEngine:
    @staticmethod
    def compute_level_info(xp: int) -> Dict[str, Any]:
        """
        XP를 바탕으로 레벨, 다음 레벨까지 남은 XP, 칭호를 계산함.
        """
        # 레벨 계산: 100 XP당 1레벨
        level = 1 + (xp // 100)
        
        # 다음 레벨까지 필요한 절대 XP
        next_level_xp = ((xp // 100) + 1) * 100
        
        # 현재 레벨 내에서의 진행도 (0~99)
        xp_into_level = xp % 100
        
        # 현재 레벨에 해당하는 칭호 찾기
        current_title = "응애 돌고래"
        current_desc = "나.. 이제 바다에요"
        
        for threshold, title, desc in DOLPHIN_TITLES:
            if level >= threshold:
                current_title = title
                current_desc = desc
                break
        
        return {
            "level": level,
            "current_xp": xp,
            "next_level_xp": next_level_xp,
            "xp_into_level": xp_into_level,
            "xp_for_level": 100,
            "title": current_title,
            "description": current_desc
        }

    @staticmethod
    def calculate_new_xp(current_xp: int, added_xp: int) -> int:
        """새로운 XP를 더할 때 음수가 되지 않도록 방지"""
        return max(0, current_xp + int(added_xp))