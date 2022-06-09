import threading
from typing import Callable, Any

#from: https://gist.github.com/gquittet/14a824876a57e118fa8d6aaedf8224f1
class Interval(threading.Thread):
    """
    This class makes the same job as setInterval in JavaScript.
    AKA execute a function each seconds.
    """
    def __init__(
            self,
            interval: float,
            function: Callable[[Any], Any],
            args=None,
            kwargs=None,
    ) -> 'Interval':
        threading.Thread.__init__(self)
        self.interval = interval
        self.function = function
        self.args = args if args is not None else []
        self.kwargs = kwargs if kwargs is not None else {}
        self.event = threading.Event()
        self.thread = threading.Thread(target=self.run)

    def cancel(self) -> None:
        self.event.set()
        if self.event.is_set():
            self.join()

    def run(self) -> None:
        while not (self.event.is_set() or self.event.wait(self.interval)):
            self.function(*self.args, **self.kwargs)

    def start(self) -> None:
        self.thread.start()
    
    def stop(self) -> None:
        self.event.set()
        self.thread.join()