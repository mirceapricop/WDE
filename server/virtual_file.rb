class VirtualFile

  def initialize
    @lines = Array.new
  end

  def insertLine(l)
    @lines << l
  end

  def each_line
    @lines.each do |l|
      yield l
    end
  end

end
